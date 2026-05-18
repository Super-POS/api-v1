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

// ===========================================================================>> Third Party Library
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BakongKHQR, IndividualInfo, khqrData } = require("bakong-khqr");

// ===========================================================================>> Custom Library
import { OrderService } from "src/app/resources/r2-cashier/c1-order/service";
import { NotificationsGateway } from "src/app/utils/notification-getway/notifications.gateway";
import Order from "@app/models/order/order.model";
import { OrderStatusEnum } from "@app/enums/order-status.enum";
import PaymentTransaction, {
  PaymentMethod,
  PaymentStatus,
} from "@app/models/payment/payment_transaction.model";
import { ExchangeSettingService } from "src/app/services/exchange-setting.service";

/**
 * Bakong KHQR integration.
 *
 * Reference documents (all bundled at `api-v1/documentation/integration/`):
 *   - "QR Payment Integration.pdf"  — system interaction flow + Open API contract.
 *   - "KHQR SDK Document.pdf"       — `bakong-khqr` SDK usage + required fields.
 *   - "KHQR Content Guideline v.1.3.pdf" — EMVCo tag layout, currency tag 53, amount tag 54.
 *
 * Live portal: https://api-bakong.nbc.gov.kh/document
 *   - Production endpoint base:  https://api-bakong.nbc.org.kh   (a `.gov.kh` mirror also works)
 *   - SIT endpoint base:         https://sit-api-bakong.nbc.org.kh
 *
 * Cashier flow (sections 2-5 of "QR Payment Integration.pdf", SDK side):
 *   1. Cashier creates the order; we call `createIntentForCashierOrder()`.
 *   2. We generate the KHQR via `BakongKHQR.generateIndividual` using the configured Bakong
 *      account id + merchant info, **converting the order's total to the QR's declared currency**.
 *   3. The SDK returns `{ qr, md5 }`. We persist the md5 as the `PaymentTransaction.reference`
 *      and stamp `expires_at` (default 10 minutes — the doc forbids exceeding 10 minutes).
 *   4. Cashier UI displays the QR. The customer scans + pays with any Bakong/KHQR-enabled app.
 *   5. The front-end polls `GET /cashier/ordering/bakong/order/:id/payment-state` (which calls
 *      `getPaymentStateForPos`). While the transaction is still PENDING we forward the check
 *      to `POST /v1/check_transaction_by_md5` per the doc.
 *   6. Per the doc's `responseCode` matrix:
 *        - `0`  → "Getting transaction successfully" → mark SUCCESS + advance order.
 *        - `1`  + "Transaction failed"           → mark FAILED.
 *        - `1`  + "Transaction could not be found"→ stay PENDING; keep polling until QR expiry.
 *        - any other transport/HTTP error        → log + swallow; the next poll will retry.
 *   7. When the QR's `expires_at` has elapsed, the next poll flips the transaction to EXPIRED
 *      without contacting Bakong (doc: "if status is not found and QR expired then ... time-out").
 */

export interface BakongCreateIntentResult {
  qr: string;
  md5: string;
  payment_transaction_id: number;
  expires_at: string;
  /** Amount actually encoded in the KHQR (in the configured QR currency). */
  qr_amount: number;
  /** Currency tag carried in the KHQR (KHR or USD). */
  qr_currency: "USD" | "KHR";
}

interface BakongApiResponse {
  responseCode: number;
  responseMessage: string;
  errorCode?: number | null;
  data?: Record<string, unknown> | null;
}

interface BakongRenewTokenResponse extends BakongApiResponse {
  data?: { token?: string; access_token?: string } | null;
  token?: string;
  access_token?: string;
}

/** Discriminator used in `PaymentTransaction.note` so we can tell Bakong + Baray apart. */
const BAKONG_NOTE = "bakong";

/** Default QR validity. Bakong doc: "The QR code time-out which shall not exceed 10 mins." */
const DEFAULT_QR_EXPIRY_MINUTES = 10;

@Injectable()
export class BakongService {
  private readonly logger = new Logger(BakongService.name);
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly merchantId: string;
  private readonly merchantName: string;
  private readonly merchantCity: string;
  private readonly currency: "USD" | "KHR";
  private readonly qrExpiryMs: number;
  private token: string;

  constructor(
    private readonly _http: HttpService,
    private readonly _notifications: NotificationsGateway,
    @Inject(forwardRef(() => OrderService))
    private readonly _orderService: OrderService,
    private readonly _exchange: ExchangeSettingService,
  ) {
    this.baseUrl = (process.env.BAKONG_BASE_URL || "https://api-bakong.nbc.gov.kh").replace(/\/$/, "");
    this.email = process.env.BAKONG_EMAIL || "";
    this.merchantId = process.env.BAKONG_MERCHANT_ID || "";
    this.merchantName = process.env.BAKONG_MERCHANT_NAME || "POS Store";
    this.merchantCity = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";
    const rawCurrency = (process.env.BAKONG_CURRENCY || "USD").toUpperCase();
    this.currency = rawCurrency === "KHR" ? "KHR" : "USD";
    const expiryMinutes = Number(process.env.BAKONG_QR_EXPIRY_MINUTES || DEFAULT_QR_EXPIRY_MINUTES);
    const clampedMinutes = Math.min(Math.max(1, expiryMinutes), DEFAULT_QR_EXPIRY_MINUTES);
    if (clampedMinutes !== expiryMinutes) {
      this.logger.warn(
        `BAKONG_QR_EXPIRY_MINUTES=${expiryMinutes} clamped to ${clampedMinutes} (Bakong allows <= 10).`,
      );
    }
    this.qrExpiryMs = clampedMinutes * 60 * 1000;
    this.token = process.env.BAKONG_TOKEN || "";
  }

  // =========================================================================>> Public API

  async createIntentForCashierOrder(
    cashierId: number,
    orderId: number,
  ): Promise<BakongCreateIntentResult> {
    this._ensureConfigured();
    const order = await Order.findByPk(orderId);
    if (!order) throw new NotFoundException("Order not found.");
    return this._createBakongIntentFromOrder(order, cashierId);
  }

  async getPaymentStateForPos(orderId: number): Promise<{
    data: {
      order_id: number;
      order_status: string;
      bakong_transaction_status: string | null;
      bakong_response_message: string | null;
    };
  }> {
    const order = await Order.findByPk(orderId, {
      attributes: ["id", "status", "receipt_number", "cashier_id"],
    });
    if (!order) throw new NotFoundException("Order not found.");

    const tx = await this._latestBakongTx(orderId);

    let lastResponseMessage: string | null = null;
    if (tx && tx.status === PaymentStatus.PENDING && tx.reference) {
      lastResponseMessage = await this._checkAndSettleTransaction(tx, order);
      await tx.reload();
    }

    return {
      data: {
        order_id: order.id,
        order_status: String(order.status),
        bakong_transaction_status: tx != null ? String(tx.status) : null,
        bakong_response_message: lastResponseMessage,
      },
    };
  }

  // =========================================================================>> Token lifecycle

  private _isTokenExpiredOrMissing(): boolean {
    if (!this.token) return true;
    try {
      const parts = this.token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf8"),
      ) as { exp?: number };
      if (!payload.exp) return false;
      return Date.now() / 1000 >= payload.exp - 60;
    } catch {
      return true;
    }
  }

  private async _ensureValidToken(): Promise<void> {
    if (!this._isTokenExpiredOrMissing()) return;
    if (!this.email) {
      throw new BadRequestException(
        "BAKONG_TOKEN is expired and BAKONG_EMAIL is not set. Cannot renew.",
      );
    }
    try {
      const res = await firstValueFrom(
        this._http.post<BakongRenewTokenResponse>(
          `${this.baseUrl}/v1/renew_token`,
          { email: this.email },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            timeout: 30_000,
          },
        ),
      );
      const body = res.data;
      const fresh =
        body?.data?.token ||
        body?.data?.access_token ||
        body?.token ||
        body?.access_token;
      if (body?.responseCode === 0 && typeof fresh === "string" && fresh.length > 0) {
        this.token = fresh;
        this.logger.log("Bakong token renewed successfully via /v1/renew_token.");
      } else {
        throw new BadRequestException(
          `Bakong token renewal failed: ${body?.responseMessage ?? "no token in response"}`,
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      if (isAxiosError(e)) {
        throw new BadRequestException(`Bakong token renewal HTTP error: ${e.message}`);
      }
      throw new BadRequestException("Bakong token renewal failed.");
    }
  }

  // =========================================================================>> Intent creation

  private async _createBakongIntentFromOrder(
    order: Order,
    processedBy: number | null,
  ): Promise<BakongCreateIntentResult> {
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
      throw new BadRequestException("Bakong payment is not available for this order state.");
    }

    await this._expireStalePendingTransactions(orderId);

    const existingPending = await PaymentTransaction.findOne({
      where: { order_id: orderId, status: PaymentStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException(
        "This order already has a pending payment. Wait for it to complete or mark it failed first.",
      );
    }

    const expiresAt = new Date(Date.now() + this.qrExpiryMs);
    const qrAmount = await this._amountInQrCurrency(Number(order.total_price));

    const individualInfo = new IndividualInfo(
      this.merchantId,
      this.merchantName,
      this.merchantCity,
      {
        currency: this._getCurrencyCode(),
        amount: qrAmount,
        billNumber: `ORDER-${orderId}`,
        storeLabel: this.merchantName,
        // The KHQR SDK encodes this as an EMVCo `99` tag with the QR expiry timestamp.
        // Customer wallets that honour the field will refuse stale QRs client-side.
        expirationTimestamp: expiresAt.getTime(),
      },
    );

    const khqr = new BakongKHQR();
    const result = khqr.generateIndividual(individualInfo) as {
      status: { code: number; message?: string };
      data: { qr: string; md5: string } | null;
    };

    if (result.status.code !== 0 || !result.data) {
      throw new BadRequestException(
        `Failed to generate KHQR: ${result.status.message ?? "unknown error"}`,
      );
    }

    const { qr, md5 } = result.data;

    const tx = await PaymentTransaction.create({
      order_id: orderId,
      customer_id: order.customer_id ?? null,
      processed_by: processedBy ?? undefined,
      method: PaymentMethod.QR,
      status: PaymentStatus.PENDING,
      amount: Number(order.total_price),
      reference: md5,
      note: BAKONG_NOTE,
      expires_at: expiresAt,
    });

    await order.update({ status: OrderStatusEnum.AWAITING_PAYMENT });

    this.logger.log(
      `Bakong intent created for order=${orderId} tx=${tx.id} amount=${qrAmount} ${this.currency} expires_at=${expiresAt.toISOString()}`,
    );

    return {
      qr,
      md5,
      payment_transaction_id: tx.id,
      expires_at: expiresAt.toISOString(),
      qr_amount: qrAmount,
      qr_currency: this.currency,
    };
  }

  // =========================================================================>> Polling logic

  /**
   * Polls Bakong once. Returns the response message (or transport error message) for the caller
   * to expose to the cashier-facing payment-state endpoint. Internally updates the tx state.
   */
  private async _checkAndSettleTransaction(
    tx: PaymentTransaction,
    order: Order,
  ): Promise<string | null> {
    if (tx.expires_at && new Date() > tx.expires_at) {
      await tx.update({ status: PaymentStatus.EXPIRED });
      this.logger.log(`Bakong tx=${tx.id} expired before settlement (QR window elapsed).`);
      return "QR expired before payment was received.";
    }

    try {
      await this._ensureValidToken();
    } catch (e) {
      this.logger.warn(`Bakong token unavailable during poll: ${(e as Error).message}`);
      return (e as Error).message;
    }

    try {
      const res = await firstValueFrom(
        this._http.post<BakongApiResponse>(
          `${this.baseUrl}/v1/check_transaction_by_md5`,
          { md5: tx.reference },
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${this.token}`,
            },
            timeout: 30_000,
          },
        ),
      );
      const body = res.data;
      const message = body?.responseMessage ?? "";

      if (body?.responseCode === 0 && body.data) {
        await this._markTransactionPaid(tx, order, body);
        return message || "Payment confirmed.";
      }

      if (body?.responseCode === 1) {
        const lower = message.toLowerCase();
        if (lower.includes("could not be found") || lower.includes("not found")) {
          // Doc: "if status is not found and QR doesn't expire then still keep checking."
          return message;
        }
        if (lower.includes("failed")) {
          await tx.update({
            status: PaymentStatus.FAILED,
            paid_at: new Date(),
          });
          this.logger.warn(`Bakong tx=${tx.id} marked FAILED: ${message}`);
          return message;
        }
      }

      this.logger.warn(
        `Bakong tx=${tx.id} unexpected response responseCode=${body?.responseCode} message="${message}"`,
      );
      return message || null;
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 401) {
        this.token = "";
        this.logger.warn("Bakong returned 401 — clearing cached token; next poll will renew.");
      }
      this.logger.warn(`Bakong check_transaction_by_md5 error: ${(e as Error).message}`);
      return null;
    }
  }

  private async _markTransactionPaid(
    tx: PaymentTransaction,
    order: Order,
    body: BakongApiResponse,
  ): Promise<void> {
    await tx.update({ status: PaymentStatus.SUCCESS, paid_at: new Date() });
    if (order.status === OrderStatusEnum.AWAITING_PAYMENT) {
      await order.update({ status: OrderStatusEnum.PENDING });
    }
    try {
      // The OrderService notifier is named for the legacy Baray flow but its body is payment-agnostic
      // (it just pushes Telegram/FCM placement notifications for an order that has just been paid).
      await this._orderService.sendPlacedNotificationsAfterBarayPayment(order.id, {});
    } catch {
      // Telegram/FCM optional
    }
    this._notifications.emitBakongPaymentSuccess({
      orderId: order.id,
      receiptNumber: String(order.receipt_number ?? ""),
      cashierId: Number(order.cashier_id ?? 0),
    });
    const txData = (body.data ?? {}) as {
      hash?: string;
      fromAccountId?: string;
      toAccountId?: string;
      amount?: number;
      currency?: string;
    };
    this.logger.log(
      `Bakong tx=${tx.id} order=${order.id} SUCCESS — from=${txData.fromAccountId ?? "?"} ` +
        `amount=${txData.amount ?? "?"} ${txData.currency ?? "?"} hash=${txData.hash ?? "?"}`,
    );
  }

  // =========================================================================>> Helpers

  private _ensureConfigured(): void {
    if (!this.merchantId) {
      throw new BadRequestException(
        "Bakong is not configured. Set BAKONG_MERCHANT_ID (e.g. yourstore@acleda).",
      );
    }
  }

  private _getCurrencyCode(): number {
    return this.currency === "KHR"
      ? (khqrData.currency.khr as number)
      : (khqrData.currency.usd as number);
  }

  /**
   * Converts the order's KHR-denominated total to whatever currency the merchant has configured
   * the KHQR to declare (tag 53). Without this, a USD-configured merchant generates a QR for the
   * raw KHR figure (e.g. ฿12,000 KHR becomes "$12,000 USD" in the wallet) — a critical bug.
   *
   * USD amounts are rounded to 2 decimals (EMVCo amount tag 54 allows decimals); KHR amounts are
   * rounded to whole riels.
   */
  private async _amountInQrCurrency(orderTotalKhr: number): Promise<number> {
    if (!Number.isFinite(orderTotalKhr) || orderTotalKhr <= 0) {
      throw new BadRequestException("Order has no positive total to charge.");
    }
    if (this.currency === "KHR") {
      return Math.round(orderTotalKhr);
    }
    const khrPerUsd = await this._exchange.getKhrPerUsd();
    if (!Number.isFinite(khrPerUsd) || khrPerUsd <= 0) {
      throw new BadRequestException("Cannot convert order total — exchange rate is unavailable.");
    }
    const usd = orderTotalKhr / khrPerUsd;
    return Math.round(usd * 100) / 100;
  }

  /** Latest Bakong transaction (any status) for the order — used by the polling endpoint. */
  private _latestBakongTx(orderId: number): Promise<PaymentTransaction | null> {
    return PaymentTransaction.findOne({
      where: { order_id: orderId, note: BAKONG_NOTE },
      order: [["id", "DESC"]],
    });
  }

  /**
   * Per the QR Payment Integration doc:
   *   "if status is not found and QR expired then integrator back-end updates transaction status
   *    to time-out."
   * If a cashier abandons a QR (closes the window mid-flow), the next intent attempt would
   * otherwise hit the "this order already has a pending payment" guard. This helper flips any
   * stale PENDING Bakong txns to EXPIRED so retries are possible.
   */
  private async _expireStalePendingTransactions(orderId: number): Promise<void> {
    const now = new Date();
    await PaymentTransaction.update(
      { status: PaymentStatus.EXPIRED },
      {
        where: {
          order_id: orderId,
          note: BAKONG_NOTE,
          status: PaymentStatus.PENDING,
          expires_at: { [Op.lt]: now },
        },
      },
    );
  }
}
