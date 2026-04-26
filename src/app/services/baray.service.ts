// ===========================================================================>> Core Library
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { isAxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import * as crypto from "crypto";

// ===========================================================================>> Custom Library
import { OrderService } from "src/app/resources/r2-cashier/c1-order/service";
import { NotificationsGateway } from "src/app/utils/notification-getway/notifications.gateway";
import Order from "@app/models/order/order.model";
import { OrderStatusEnum } from "@app/enums/order-status.enum";
import PaymentTransaction, {
  PaymentMethod,
  PaymentStatus,
} from "@app/models/payment/payment_transaction.model";

export interface BarayCreateIntentResult {
  _id: string;
  url: string;
  status: string;
  expires_at: string;
  payment_transaction_id: number;
}

@Injectable()
export class BarayService {
  private readonly payUrl: string;
  /** User-facing pay page, e.g. https://pay.baray.io — Baray /pay often returns only `_id`, not a full `url`. */
  private readonly payCheckoutBase: string;
  private readonly apiKey: string;
  private readonly secretB64: string;
  private readonly ivB64: string;
  private readonly currency: string;
  private readonly orderIdPrefix: string;

  constructor(
    private readonly _http: HttpService,
    private readonly _notifications: NotificationsGateway,
    @Inject(forwardRef(() => OrderService))
    private readonly _orderService: OrderService,
  ) {
    // Full URL to POST (include path, e.g. https://api.baray.io/pay)
    this.payUrl = (process.env.BARAY_PAY_URL || "https://api.baray.io/pay").replace(/\/$/, "");
    this.payCheckoutBase = (process.env.BARAY_CHECKOUT_BASE_URL || "https://pay.baray.io").replace(/\/$/, "");
    this.apiKey = process.env.BARAY_API_KEY || "";
    this.secretB64 = process.env.BARAY_SK || process.env.BARAY_SECRET_KEY || "";
    this.ivB64 = process.env.BARAY_IV || "";
    this.currency = process.env.BARAY_CURRENCY || "USD";
    this.orderIdPrefix = process.env.BARAY_ORDER_ID_PREFIX || "pos-order-";
  }

  private _ensureConfigured(): void {
    if (!this.apiKey || !this.secretB64 || !this.ivB64) {
      throw new BadRequestException(
        "Baray is not configured. Set BARAY_API_KEY, BARAY_SK (or BARAY_SECRET_KEY), and BARAY_IV (base64).",
      );
    }
  }

  /**
   * POS long-poll: single source of truth for Baray (order row + baray `payment_transaction`).
   * If the webhook updated the tx to `success` but the order row is still wrong, we still see success here.
   */
  async getPaymentStateForPos(orderId: number): Promise<{
    data: {
      order_id: number;
      order_status: string;
      baray_transaction_status: string | null;
    };
  }> {
    const order = await Order.findByPk(orderId, { attributes: ["id", "status"] });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    const tx = await PaymentTransaction.findOne({
      where: { order_id: orderId, note: "baray" },
      order: [["id", "DESC"]],
      attributes: ["status"],
    });
    return {
      data: {
        order_id: order.id,
        order_status: String(order.status),
        baray_transaction_status: tx != null ? String(tx.status) : null,
      },
    };
  }

  /** Public order id string sent to Baray and round-tripped in webhooks. */
  makeExternalOrderId(localOrderId: number): string {
    return `${this.orderIdPrefix}${localOrderId}`;
  }

  parseLocalOrderIdFromBarayValue(decrypted: string): number | null {
    const t = (decrypted || "").trim();
    const m = t.match(
      new RegExp(`^${this.orderIdPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`),
    );
    if (m) {
      return Number(m[1]);
    }
    try {
      const o = JSON.parse(t) as { order_id?: string };
      if (o?.order_id) {
        return this.parseLocalOrderIdFromBarayValue(o.order_id);
      }
    } catch {
      // not JSON
    }
    return null;
  }

  encrypt(payload: Record<string, unknown>): string {
    this._ensureConfigured();
    const key = Buffer.from(this.secretB64, "base64");
    const iv = Buffer.from(this.ivB64, "base64");
    if (key.length !== 32) {
      throw new BadRequestException("Baray secret key (base64) must decode to 32 bytes for AES-256.");
    }
    if (iv.length !== 16) {
      throw new BadRequestException("Baray IV (base64) must decode to 16 bytes.");
    }
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    const buf = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    return buf.toString("base64");
  }

  /** Decrypt payload from Baray (e.g. webhook `encrypted_order_id`). */
  decrypt(encryptedData: string): string {
    this._ensureConfigured();
    const key = Buffer.from(this.secretB64, "base64");
    const iv = Buffer.from(this.ivB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  }

  private _formatAmount(total: number): string {
    const decimals = Math.max(0, Math.min(4, Number(process.env.BARAY_AMOUNT_DECIMALS ?? 2)));
    return Number(total).toFixed(decimals);
  }

  /**
   * Cashier: create a Baray payment link for an existing order. Uses PaymentMethod.QR with note=baray.
   */
  async createIntentForCashierOrder(
    cashierId: number,
    orderId: number,
  ): Promise<BarayCreateIntentResult> {
    this._ensureConfigured();
    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
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
      throw new BadRequestException("Baray payment is not available for this order state.");
    }

    const anyBarayTx = await PaymentTransaction.findOne({ where: { order_id: orderId, note: "baray" } });
    if (order.status === OrderStatusEnum.PENDING && anyBarayTx) {
      throw new BadRequestException(
        "This order was already used with Baray (paid, or a link was issued). Create a new order to charge again.",
      );
    }

    const existingPending = await PaymentTransaction.findOne({
      where: { order_id: orderId, status: PaymentStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException(
        "This order already has a pending payment. Wait for it to complete or mark it failed/expired first.",
      );
    }

    const externalOrderId = this.makeExternalOrderId(orderId);
    const bodyPayload = {
      amount: this._formatAmount(Number(order.total_price)),
      currency: this.currency,
      order_id: externalOrderId,
    };
    const encrypted = this.encrypt(bodyPayload);

    type BarayPayPayload = { _id?: string; id?: string; url?: string; status?: string; expires_at?: string; data?: unknown };
    let barayResBody: unknown;
    let raw: BarayPayPayload;
    try {
      const res = await firstValueFrom(
        this._http.post<BarayPayPayload | { data?: BarayPayPayload }>(
          this.payUrl,
          { data: encrypted },
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.apiKey,
            },
            timeout: 60_000,
          },
        ),
      );
      barayResBody = res.data;
      const top = res.data as { _id?: string; data?: BarayPayPayload } & BarayPayPayload;
      raw = (top?.data && typeof top.data === "object" ? top.data : top) as BarayPayPayload;
    } catch (e) {
      if (isAxiosError(e)) {
        const status = e.response?.status;
        const body = e.response?.data;
        const text =
          body === undefined
            ? e.message
            : typeof body === "string"
              ? body
              : JSON.stringify(body);
        throw new BadRequestException(`Baray: HTTP ${status ?? "?"} — ${text}`);
      }
      const msg = (e as Error)?.message || "Baray request failed";
      throw new BadRequestException(`Baray: ${msg}`);
    }

    const _id = (raw._id || raw.id) as string;
    let url = typeof raw.url === "string" ? raw.url : "";
    if (_id && !url) {
      url = `${this.payCheckoutBase}/${_id}`;
    }
    if (!_id || !url) {
      throw new BadRequestException(
        `Baray did not return a payment id. Response: ${
          typeof barayResBody === "string" ? barayResBody : JSON.stringify(barayResBody)
        }`.slice(0, 2_000),
      );
    }

    const expires = raw.expires_at
      ? new Date(raw.expires_at)
      : new Date(Date.now() + 15 * 60 * 1000);

    const tx = await PaymentTransaction.create({
      order_id: orderId,
      customer_id: order.customer_id ?? null,
      processed_by: cashierId,
      method: PaymentMethod.QR,
      status: PaymentStatus.PENDING,
      amount: Number(order.total_price),
      reference: _id,
      note: "baray",
      expires_at: expires,
    });

    await order.update({ status: OrderStatusEnum.AWAITING_PAYMENT });

    return {
      _id,
      url,
      status: (raw.status as string) || "pending",
      expires_at: (raw.expires_at as string) || expires.toISOString(),
      payment_transaction_id: tx.id,
    };
  }

  /**
   * Baray posts base64 ciphertext under `encrypted_order_id` (see baray.io); some builds use `data` or nesting.
   */
  private _extractBarayEncryptedPayload(body: Record<string, unknown>): string | null {
    for (const key of ["encrypted_order_id", "data", "payload", "encrypted", "ciphertext"] as const) {
      const v = body[key];
      if (typeof v === "string" && v.length > 0) {
        return v;
      }
    }
    const data = body["data"];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const o = data as Record<string, unknown>;
      for (const k of ["encrypted", "data", "ciphertext"] as const) {
        const inner = o[k];
        if (typeof inner === "string" && inner.length > 0) {
          return inner;
        }
      }
    }
    return null;
  }

  /**
   * Webhook: decrypt Baray payload and mark payment + order as completed when successful.
   */
  async handleWebhook(body: Record<string, unknown>): Promise<void> {
    this._ensureConfigured();
    const enc = this._extractBarayEncryptedPayload(body);
    if (!enc) {
      throw new BadRequestException("Missing encrypted payload.");
    }
    const st = body["status"] ?? body["payment_status"] ?? body["state"];
    if (st && String(st).toLowerCase() === "failed") {
      return;
    }
    const plain = this.decrypt(enc);
    const localId = this.parseLocalOrderIdFromBarayValue(plain);
    if (localId == null || !Number.isFinite(localId)) {
      throw new BadRequestException("Could not resolve local order from webhook payload.");
    }
    const order = await Order.findByPk(localId);
    if (!order) {
      throw new NotFoundException("Order not found for webhook.");
    }
    const tx = await PaymentTransaction.findOne({
      where: {
        order_id: order.id,
        status: PaymentStatus.PENDING,
        note: "baray",
      },
      order: [["id", "DESC"]],
    });
    if (!tx) {
      throw new NotFoundException("No Baray payment transaction for this order.");
    }
    if (tx.status === PaymentStatus.SUCCESS) {
      return;
    }
    await tx.update({
      status: PaymentStatus.SUCCESS,
      paid_at: new Date(),
    });
    // Money received — order may enter the normal kitchen queue (preparing / ready), not "done" by itself.
    if (order.status === OrderStatusEnum.AWAITING_PAYMENT) {
      await order.update({ status: OrderStatusEnum.PENDING });
    }
    try {
      await this._orderService.sendPlacedNotificationsAfterBarayPayment(localId);
    } catch {
      // Telegram/FCM optional; payment is already recorded
    }
    this._notifications.emitBarayPaymentSuccess({
      orderId: localId,
      receiptNumber: String(order.receipt_number ?? ""),
      cashierId: Number(order.cashier_id ?? 0),
    });
  }
}
