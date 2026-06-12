// ===========================================================================>> Core Library
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { isAxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { Op } from "sequelize";
import * as crypto from "crypto";

// ===========================================================================>> Custom Library
import { OrderService } from "src/app/resources/r2-cashier/c1-order/service";
import { NotificationsGateway } from "src/app/utils/notification-getway/notifications.gateway";
import { ExchangeSettingService } from "src/app/services/exchange-setting.service";
import Order from "@app/models/order/order.model";
import { OrderStatusEnum } from "@app/enums/order-status.enum";
import PaymentTransaction, {
  PaymentMethod,
  PaymentStatus,
} from "@app/models/payment/payment_transaction.model";

export type PaywayPaymentOption = "abapay_khqr" | "wechat" | "alipay";

export interface PaywayCreateIntentResult {
  qr: string;
  tran_id: string;
  payment_transaction_id: number;
  expires_at: string;
  qr_amount: number;
  qr_currency: "USD" | "KHR";
  payment_option: PaywayPaymentOption;
  merchant_name: string;
  merchant_city: string;
  abapay_deeplink?: string | null;
}

interface PaywayStatusBlock {
  code?: string | number;
  message?: string;
  trace_id?: string;
  tran_id?: string;
}

interface PaywayGenerateQrResponse {
  status?: PaywayStatusBlock;
  qrString?: string;
  qrImage?: string;
  amount?: number;
  currency?: string;
  abapay_deeplink?: string;
}

interface PaywayCheckTxData {
  payment_status_code?: number;
  payment_status?: string;
  payment_amount?: number;
  payment_currency?: string;
  apv?: string;
  transaction_date?: string;
}

interface PaywayCheckTxResponse {
  status?: PaywayStatusBlock;
  data?: PaywayCheckTxData;
}

const PAYWAY_NOTE = "payway";

function paywayNoteWithQr(paymentOption: PaywayPaymentOption, qr: string): string {
  return `${PAYWAY_NOTE}|${paymentOption}\n${qr}`;
}

function parseQrFromPaywayNote(note: string | null | undefined): {
  paymentOption: PaywayPaymentOption;
  qr: string;
} | null {
  if (!note) return null;
  const raw = String(note);
  if (!raw.startsWith(`${PAYWAY_NOTE}|`)) return null;
  const nl = raw.indexOf("\n");
  if (nl < 0) return null;
  const header = raw.slice(0, nl);
  const qr = raw.slice(nl + 1).trim();
  const option = header.slice(`${PAYWAY_NOTE}|`.length) as PaywayPaymentOption;
  if (!qr) return null;
  if (option !== "abapay_khqr" && option !== "wechat" && option !== "alipay") {
    return { paymentOption: "abapay_khqr", qr };
  }
  return { paymentOption: option, qr };
}

const DEFAULT_QR_LIFETIME_MINUTES = 15;

@Injectable()
export class PaywayService {
  private readonly logger = new Logger(PaywayService.name);
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly apiKey: string;
  private readonly currency: "USD" | "KHR";
  private readonly merchantName: string;
  private readonly merchantCity: string;
  private readonly qrLifetimeMinutes: number;
  private readonly qrImageTemplate: string;
  private readonly callbackUrlB64: string;

  constructor(
    private readonly _http: HttpService,
    private readonly _notifications: NotificationsGateway,
    @Inject(forwardRef(() => OrderService))
    private readonly _orderService: OrderService,
    private readonly _exchange: ExchangeSettingService,
  ) {
    this.baseUrl = (
      process.env.PAYWAY_BASE_URL || "https://checkout-sandbox.payway.com.kh"
    ).replace(/\/$/, "");
    this.merchantId = process.env.PAYWAY_MERCHANT_ID || "";
    this.apiKey = process.env.PAYWAY_API_KEY || "";
    const rawCurrency = (process.env.PAYWAY_CURRENCY || "USD").toUpperCase();
    this.currency = rawCurrency === "KHR" ? "KHR" : "USD";
    this.merchantName = process.env.PAYWAY_MERCHANT_NAME || "POS Store";
    this.merchantCity = process.env.PAYWAY_MERCHANT_CITY || "Phnom Penh";
    const lifetime = Number(process.env.PAYWAY_QR_LIFETIME_MINUTES || DEFAULT_QR_LIFETIME_MINUTES);
    this.qrLifetimeMinutes = Math.min(Math.max(3, lifetime), 30 * 24 * 60);
    this.qrImageTemplate = process.env.PAYWAY_QR_IMAGE_TEMPLATE || "template3_color";
    const callbackRaw = (process.env.PAYWAY_CALLBACK_URL || "").trim();
    this.callbackUrlB64 = callbackRaw ? Buffer.from(callbackRaw, "utf8").toString("base64") : "";
  }

  async createIntentForCashierOrder(
    cashierId: number,
    orderId: number,
    paymentOption: PaywayPaymentOption,
  ): Promise<PaywayCreateIntentResult> {
    this._ensureConfigured();
    this._validatePaymentOption(paymentOption);
    const order = await Order.findByPk(orderId);
    if (!order) throw new NotFoundException("Order not found.");
    return this._createIntentFromOrder(order, cashierId, paymentOption);
  }

  async getPaymentStateForPos(orderId: number): Promise<{
    data: {
      order_id: number;
      order_status: string;
      aba_transaction_status: string | null;
      aba_response_message: string | null;
    };
  }> {
    const order = await Order.findByPk(orderId, {
      attributes: ["id", "status", "receipt_number", "cashier_id"],
    });
    if (!order) throw new NotFoundException("Order not found.");

    const tx = await this._latestPaywayTx(orderId);
    let lastMessage: string | null = null;
    if (tx && tx.status === PaymentStatus.PENDING && tx.reference) {
      lastMessage = await this._checkAndSettleTransaction(tx, order);
      await tx.reload();
    }

    return {
      data: {
        order_id: order.id,
        order_status: String(order.status),
        aba_transaction_status: tx != null ? String(tx.status) : null,
        aba_response_message: lastMessage,
      },
    };
  }

  /** PayWay pushback / KHQR webhook — POST /api/webhooks/payway */
  async handleWebhookPayload(body: Record<string, unknown>): Promise<void> {
    const tranId =
      (body.tran_id as string) ||
      (body.transaction_id as string) ||
      (body.merchant_ref as string) ||
      (body.merchant_ref_no as string);
    if (!tranId) {
      this.logger.warn("PayWay webhook: missing tran_id / merchant_ref.");
      return;
    }

    const statusRaw = body.status ?? body.payment_status_code;
    const statusStr = String(statusRaw ?? "").toLowerCase();
    const paymentStatus = String(body.payment_status ?? "").toUpperCase();

    const isApproved =
      statusStr === "0" ||
      statusStr === "00" ||
      paymentStatus === "APPROVED" ||
      Number(body.payment_status_code) === 0;

    if (!isApproved) {
      this.logger.log(`PayWay webhook tran=${tranId} ignored status=${statusRaw}`);
      return;
    }

    const tx = await PaymentTransaction.findOne({
      where: { reference: String(tranId), note: { [Op.like]: `${PAYWAY_NOTE}%` } },
      include: [{ model: Order, required: true }],
    });
    if (!tx || !tx.order) {
      this.logger.warn(`PayWay webhook: no tx for tran_id=${tranId}`);
      return;
    }
    if (tx.status === PaymentStatus.SUCCESS) return;
    await this._markTransactionPaid(tx, tx.order);
  }

  private async _createIntentFromOrder(
    order: Order,
    processedBy: number | null,
    paymentOption: PaywayPaymentOption,
  ): Promise<PaywayCreateIntentResult> {
    const orderId = order.id;
    if (order.total_price == null || Number(order.total_price) <= 0) {
      throw new BadRequestException("Order has no total to charge.");
    }

    const disallowed: OrderStatusEnum[] = [
      OrderStatusEnum.PREPARING,
      OrderStatusEnum.READY,
      OrderStatusEnum.COMPLETED,
      OrderStatusEnum.CANCELLED,
    ];
    if (disallowed.includes(order.status as OrderStatusEnum)) {
      throw new BadRequestException("This order has already been paid or is no longer awaiting payment.");
    }

    const alreadyPaid = await PaymentTransaction.findOne({
      where: { order_id: orderId, status: PaymentStatus.SUCCESS },
    });
    if (alreadyPaid) {
      throw new BadRequestException("This order has already been paid.");
    }

    await this._expireStalePendingTransactions(orderId);

    const existingPending = await PaymentTransaction.findOne({
      where: {
        order_id: orderId,
        status: PaymentStatus.PENDING,
        note: { [Op.like]: `${PAYWAY_NOTE}|${paymentOption}%` },
      },
      order: [["id", "DESC"]],
    });

    if (existingPending?.reference && existingPending.expires_at) {
      const cached = parseQrFromPaywayNote(existingPending.note);
      if (
        cached &&
        cached.paymentOption === paymentOption &&
        existingPending.expires_at.getTime() > Date.now()
      ) {
        const qrAmount = await this._amountInQrCurrency(Number(order.total_price));
        this._emitCustomerDisplay(orderId, cached.qr, qrAmount);
        return {
          qr: cached.qr,
          tran_id: String(existingPending.reference),
          payment_transaction_id: existingPending.id,
          expires_at: existingPending.expires_at.toISOString(),
          qr_amount: qrAmount,
          qr_currency: this.currency,
          payment_option: paymentOption,
          merchant_name: this.merchantName,
          merchant_city: this.merchantCity,
        };
      }
      await existingPending.update({ status: PaymentStatus.EXPIRED });
    }

    const qrAmount = await this._amountInQrCurrency(Number(order.total_price));
    const amountStr = this._formatAmount(qrAmount, this.currency);
    const tranId = this._makeTranId(orderId);
    const reqTime = this._reqTimeUtc();
    const lifetime = this.qrLifetimeMinutes;
    const expiresAt = new Date(Date.now() + lifetime * 60 * 1000);

    const hash = this._hashGenerateQr({
      reqTime,
      tranId,
      amount: amountStr,
      paymentOption,
      lifetime,
    });

    const payload: Record<string, unknown> = {
      req_time: reqTime,
      merchant_id: this.merchantId,
      tran_id: tranId,
      amount: amountStr,
      currency: this.currency,
      payment_option: paymentOption,
      purchase_type: "purchase",
      lifetime,
      qr_image_template: this.qrImageTemplate,
      hash,
    };
    if (this.callbackUrlB64) {
      payload.callback_url = this.callbackUrlB64;
    }

    let response: PaywayGenerateQrResponse;
    try {
      const res = await firstValueFrom(
        this._http.post<PaywayGenerateQrResponse>(
          `${this.baseUrl}/api/payment-gateway/v1/payments/generate-qr`,
          payload,
          { headers: { "Content-Type": "application/json" }, timeout: 60_000 },
        ),
      );
      response = res.data;
    } catch (e) {
      this._throwPaywayHttpError("generate-qr", e);
    }

    const code = String(response?.status?.code ?? "");
    if (code !== "0") {
      throw new BadRequestException(
        this._paywayErrorMessage(code, String(response?.status?.message ?? "")),
      );
    }

    const qr = String(response.qrString ?? "").trim();
    if (!qr) {
      throw new BadRequestException("PayWay did not return a QR string.");
    }

    const tx = await PaymentTransaction.create({
      order_id: orderId,
      customer_id: order.customer_id ?? null,
      processed_by: processedBy ?? undefined,
      method: PaymentMethod.QR,
      status: PaymentStatus.PENDING,
      amount: Number(order.total_price),
      reference: tranId,
      note: paywayNoteWithQr(paymentOption, qr),
      expires_at: expiresAt,
    });

    await order.update({ status: OrderStatusEnum.AWAITING_PAYMENT });

    this.logger.log(
      `PayWay intent order=${orderId} tx=${tx.id} tran=${tranId} option=${paymentOption} amount=${amountStr} ${this.currency}`,
    );

    this._emitCustomerDisplay(orderId, qr, qrAmount);

    return {
      qr,
      tran_id: tranId,
      payment_transaction_id: tx.id,
      expires_at: expiresAt.toISOString(),
      qr_amount: qrAmount,
      qr_currency: this.currency,
      payment_option: paymentOption,
      merchant_name: this.merchantName,
      merchant_city: this.merchantCity,
      abapay_deeplink: response.abapay_deeplink ?? null,
    };
  }

  private async _checkAndSettleTransaction(
    tx: PaymentTransaction,
    order: Order,
  ): Promise<string | null> {
    if (tx.expires_at && new Date() > tx.expires_at) {
      await tx.update({ status: PaymentStatus.EXPIRED });
      return "QR expired before payment was received.";
    }

    const tranId = String(tx.reference ?? "");
    if (!tranId) return null;

    const reqTime = this._reqTimeUtc();
    const hash = this._hashCheckTransaction(reqTime, tranId);

    try {
      const res = await firstValueFrom(
        this._http.post<PaywayCheckTxResponse>(
          `${this.baseUrl}/api/payment-gateway/v1/payments/check-transaction-2`,
          {
            req_time: reqTime,
            merchant_id: this.merchantId,
            tran_id: tranId,
            hash,
          },
          { headers: { "Content-Type": "application/json" }, timeout: 30_000 },
        ),
      );
      const body = res.data;
      const statusCode = String(body?.status?.code ?? "");
      if (statusCode !== "00" && statusCode !== "0") {
        return body?.status?.message ?? null;
      }

      const data = body.data;
      const paymentStatus = String(data?.payment_status ?? "").toUpperCase();
      const paymentCode = Number(data?.payment_status_code);

      if (paymentStatus === "APPROVED" || paymentStatus === "PRE-AUTH" || paymentCode === 0) {
        await this._markTransactionPaid(tx, order);
        return data?.payment_status ?? "APPROVED";
      }
      if (paymentStatus === "DECLINED" || paymentStatus === "CANCELLED" || paymentCode === 3 || paymentCode === 7) {
        await tx.update({ status: PaymentStatus.FAILED, paid_at: new Date() });
        return paymentStatus;
      }
      return data?.payment_status ?? "PENDING";
    } catch (e) {
      this._logHttpFailure("check-transaction-2", e);
      return null;
    }
  }

  private async _markTransactionPaid(tx: PaymentTransaction, order: Order): Promise<void> {
    if (tx.status === PaymentStatus.SUCCESS) return;
    await tx.update({ status: PaymentStatus.SUCCESS, paid_at: new Date() });
    if (order.status === OrderStatusEnum.AWAITING_PAYMENT) {
      await order.update({ status: OrderStatusEnum.PENDING });
    }
    try {
      await this._orderService.sendPlacedNotificationsAfterBarayPayment(order.id, {});
    } catch {
      // optional notifications
    }
    this._notifications.emitPaywayPaymentSuccess({
      orderId: order.id,
      receiptNumber: String(order.receipt_number ?? ""),
      cashierId: Number(order.cashier_id ?? 0),
    });
    this._notifications.emitCustomerDisplayClear({ orderId: order.id });
    this.logger.log(`PayWay tx=${tx.id} order=${order.id} SUCCESS`);
  }

  private _emitCustomerDisplay(orderId: number, qr: string, amount: number): void {
    this._notifications.emitCustomerDisplayShowKhqr({
      orderId,
      qr,
      amount,
      currency: this.currency,
      expires_at: new Date(Date.now() + this.qrLifetimeMinutes * 60 * 1000).toISOString(),
      merchant_name: this.merchantName,
      merchant_city: this.merchantCity,
    });
  }

  private _latestPaywayTx(orderId: number): Promise<PaymentTransaction | null> {
    return PaymentTransaction.findOne({
      where: { order_id: orderId, note: { [Op.like]: `${PAYWAY_NOTE}%` } },
      order: [["id", "DESC"]],
    });
  }

  private async _expireStalePendingTransactions(orderId: number): Promise<void> {
    await PaymentTransaction.update(
      { status: PaymentStatus.EXPIRED },
      {
        where: {
          order_id: orderId,
          note: { [Op.like]: `${PAYWAY_NOTE}%` },
          status: PaymentStatus.PENDING,
          expires_at: { [Op.lt]: new Date() },
        },
      },
    );
  }

  private _validatePaymentOption(option: PaywayPaymentOption): void {
    if (option === "wechat" || option === "alipay") {
      if (this.currency !== "USD") {
        throw new BadRequestException("WeChat Pay and Alipay require USD transaction currency.");
      }
    }
  }

  private async _amountInQrCurrency(orderTotalKhr: number): Promise<number> {
    if (!Number.isFinite(orderTotalKhr) || orderTotalKhr <= 0) {
      throw new BadRequestException("Order has no positive total to charge.");
    }
    if (this.currency === "KHR") {
      if (orderTotalKhr < 100) {
        throw new BadRequestException("PayWay KHR amount must be at least 100 KHR.");
      }
      return Math.round(orderTotalKhr);
    }
    const khrPerUsd = await this._exchange.getKhrPerUsd();
    if (!Number.isFinite(khrPerUsd) || khrPerUsd <= 0) {
      throw new BadRequestException("Cannot convert order total — exchange rate is unavailable.");
    }
    const usd = orderTotalKhr / khrPerUsd;
    const rounded = Math.round(usd * 100) / 100;
    if (rounded < 0.01) {
      throw new BadRequestException("PayWay USD amount must be at least 0.01 USD.");
    }
    return rounded;
  }

  private _formatAmount(amount: number, currency: "USD" | "KHR"): string {
    if (currency === "KHR") return String(Math.round(amount));
    return (Math.round(amount * 100) / 100).toFixed(2);
  }

  private _makeTranId(orderId: number): string {
    const suffix = String(Date.now() % 1_000_000_000).padStart(9, "0");
    const id = `O${orderId}T${suffix}`;
    return id.length <= 20 ? id : id.slice(0, 20);
  }

  private _reqTimeUtc(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  }

  private _hmac(parts: string[]): string {
    const b4hash = parts.join("");
    return crypto.createHmac("sha512", this.apiKey).update(b4hash).digest("base64");
  }

  private _hashGenerateQr(args: {
    reqTime: string;
    tranId: string;
    amount: string;
    paymentOption: string;
    lifetime: number;
  }): string {
    const empty = "";
    return this._hmac([
      args.reqTime,
      this.merchantId,
      args.tranId,
      args.amount,
      empty,
      empty,
      empty,
      empty,
      empty,
      "purchase",
      args.paymentOption,
      this.callbackUrlB64,
      empty,
      this.currency,
      empty,
      empty,
      empty,
      String(args.lifetime),
      this.qrImageTemplate,
    ]);
  }

  private _hashCheckTransaction(reqTime: string, tranId: string): string {
    return this._hmac([reqTime, this.merchantId, tranId]);
  }

  private _ensureConfigured(): void {
    if (!this.merchantId || !this.apiKey) {
      throw new BadRequestException(
        "PayWay is not configured. Set PAYWAY_MERCHANT_ID and PAYWAY_API_KEY.",
      );
    }
  }

  private _parsePaywayErrorBody(data: unknown): { code: string; message: string } | null {
    if (!data || typeof data !== "object") return null;
    const status = (data as PaywayGenerateQrResponse).status;
    if (!status) return null;
    return {
      code: String(status.code ?? ""),
      message: String(status.message ?? ""),
    };
  }

  private _paywayErrorMessage(code: string, message: string): string {
    if (code === "21") {
      return (
        "PayWay sandbox credentials have expired (End of API lifetime). " +
        "Register a new sandbox account at https://sandbox.payway.com.kh or contact paywaysales@ababank.com, " +
        "then update PAYWAY_MERCHANT_ID and PAYWAY_API_KEY in api-v1/.env and restart the API."
      );
    }
    if (code === "6") {
      return "PayWay rejected this server (wrong domain). Ask PayWay to whitelist your API domain or IP.";
    }
    if (code === "1") {
      return "PayWay wrong hash — verify PAYWAY_API_KEY matches your Merchant ID.";
    }
    if (message) {
      return `PayWay: ${message}`;
    }
    return code ? `PayWay error (code ${code}).` : "PayWay request failed.";
  }

  private _throwPaywayHttpError(context: string, e: unknown): never {
    if (isAxiosError(e)) {
      const parsed = this._parsePaywayErrorBody(e.response?.data);
      this._logHttpFailure(context, e);
      if (parsed) {
        throw new BadRequestException(this._paywayErrorMessage(parsed.code, parsed.message));
      }
      throw new BadRequestException(
        `PayWay ${context} failed (HTTP ${e.response?.status ?? "error"}).`,
      );
    }
    this.logger.warn(`PayWay ${context}: ${(e as Error).message}`);
    throw new BadRequestException(`PayWay ${context} failed.`);
  }

  private _logHttpFailure(context: string, e: unknown): void {
    if (isAxiosError(e)) {
      const body =
        typeof e.response?.data === "string"
          ? e.response.data
          : JSON.stringify(e.response?.data ?? {});
      this.logger.warn(`PayWay ${context} HTTP ${e.response?.status}: ${body}`);
      return;
    }
    this.logger.warn(`PayWay ${context}: ${(e as Error).message}`);
  }
}
