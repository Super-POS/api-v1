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

export interface BakongCreateIntentResult {
  qr: string;
  md5: string;
  payment_transaction_id: number;
  expires_at: string;
}

interface BakongApiResponse {
  responseCode: number;
  responseMessage: string;
  errorCode?: number | null;
  data?: Record<string, unknown> | null;
}

@Injectable()
export class BakongService {
  private readonly logger = new Logger(BakongService.name);
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly merchantId: string;
  private readonly merchantName: string;
  private readonly merchantCity: string;
  private readonly currency: string;
  private readonly qrExpiryMs: number;
  private token: string;

  constructor(
    private readonly _http: HttpService,
    private readonly _notifications: NotificationsGateway,
    @Inject(forwardRef(() => OrderService))
    private readonly _orderService: OrderService,
  ) {
    this.baseUrl = (process.env.BAKONG_BASE_URL || "https://api-bakong.nbc.gov.kh").replace(/\/$/, "");
    this.email = process.env.BAKONG_EMAIL || "";
    this.merchantId = process.env.BAKONG_MERCHANT_ID || "";
    this.merchantName = process.env.BAKONG_MERCHANT_NAME || "POS Store";
    this.merchantCity = process.env.BAKONG_MERCHANT_CITY || "Phnom Penh";
    this.currency = (process.env.BAKONG_CURRENCY || "USD").toUpperCase();
    this.qrExpiryMs = Number(process.env.BAKONG_QR_EXPIRY_MINUTES || 10) * 60 * 1000;
    this.token = process.env.BAKONG_TOKEN || "";
  }

  private _ensureConfigured(): void {
    if (!this.merchantId) {
      throw new BadRequestException(
        "Bakong is not configured. Set BAKONG_MERCHANT_ID (e.g. yourstore@acleda).",
      );
    }
  }

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
        this._http.post<BakongApiResponse & { data?: { token?: string } }>(
          `${this.baseUrl}/v1/renew_token`,
          { email: this.email },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 30_000,
          },
        ),
      );
      const body = res.data;
      if (body.responseCode === 0 && body.data?.token) {
        this.token = body.data.token as string;
        this.logger.log("Bakong token renewed successfully.");
      } else {
        throw new BadRequestException(
          `Bakong token renewal failed: ${body.responseMessage}`,
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

  private _getCurrencyCode(): number {
    return this.currency === "KHR"
      ? (khqrData.currency.khr as number)
      : (khqrData.currency.usd as number);
  }

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
    };
  }> {
    const order = await Order.findByPk(orderId, { attributes: ["id", "status", "receipt_number", "cashier_id"] });
    if (!order) throw new NotFoundException("Order not found.");

    const tx = await PaymentTransaction.findOne({
      where: { order_id: orderId, note: "bakong" },
      order: [["id", "DESC"]],
    });

    if (tx && tx.status === PaymentStatus.PENDING && tx.reference) {
      await this._checkAndSettleTransaction(tx, order);
      await tx.reload();
    }

    return {
      data: {
        order_id: order.id,
        order_status: String(order.status),
        bakong_transaction_status: tx != null ? String(tx.status) : null,
      },
    };
  }

  private async _checkAndSettleTransaction(
    tx: PaymentTransaction,
    order: Order,
  ): Promise<void> {
    if (tx.expires_at && new Date() > tx.expires_at) {
      await tx.update({ status: PaymentStatus.EXPIRED });
      return;
    }

    try {
      await this._ensureValidToken();
    } catch (e) {
      this.logger.warn(`Bakong token unavailable during poll: ${(e as Error).message}`);
      return;
    }

    try {
      const res = await firstValueFrom(
        this._http.post<BakongApiResponse>(
          `${this.baseUrl}/v1/check_transaction_by_md5`,
          { md5: tx.reference },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.token}`,
            },
            timeout: 30_000,
          },
        ),
      );
      const body = res.data;

      if (body.responseCode === 0 && body.data) {
        await tx.update({ status: PaymentStatus.SUCCESS, paid_at: new Date() });
        if (order.status === OrderStatusEnum.AWAITING_PAYMENT) {
          await order.update({ status: OrderStatusEnum.PENDING });
        }
        try {
          await this._orderService.sendPlacedNotificationsAfterBarayPayment(order.id, {});
        } catch {
          // Telegram/FCM optional
        }
        this._notifications.emitBakongPaymentSuccess({
          orderId: order.id,
          receiptNumber: String(order.receipt_number ?? ""),
          cashierId: Number(order.cashier_id ?? 0),
        });
      }
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 401) {
        this.token = "";
      }
      this.logger.warn(`Bakong check_transaction_by_md5 error: ${(e as Error).message}`);
    }
  }

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

    const existingPending = await PaymentTransaction.findOne({
      where: { order_id: orderId, status: PaymentStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException(
        "This order already has a pending payment. Wait for it to complete or mark it failed first.",
      );
    }

    const expiresAt = new Date(Date.now() + this.qrExpiryMs);

    const individualInfo = new IndividualInfo(
      this.merchantId,
      this.merchantName,
      this.merchantCity,
      {
        currency: this._getCurrencyCode(),
        amount: Number(order.total_price),
        billNumber: `ORDER-${orderId}`,
        storeLabel: this.merchantName,
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
      note: "bakong",
      expires_at: expiresAt,
    });

    await order.update({ status: OrderStatusEnum.AWAITING_PAYMENT });

    return {
      qr,
      md5,
      payment_transaction_id: tx.id,
      expires_at: expiresAt.toISOString(),
    };
  }
}
