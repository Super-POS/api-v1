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
import * as crypto from "crypto";

// ===========================================================================>> Custom Library
import { OrderService } from "src/app/resources/r2-cashier/c1-order/service";
import { NotificationsGateway } from "src/app/utils/notification-getway/notifications.gateway";
import { ExchangeSettingService, khrToUsdDisplay } from "src/app/services/exchange-setting.service";
import { TelegramService } from "src/app/services/telegram.service";
import Order from "@app/models/order/order.model";
import User from "@app/models/user/user.model";
import { OrderStatusEnum } from "@app/enums/order-status.enum";
import PaymentTransaction, {
  PaymentMethod,
  PaymentStatus,
} from "@app/models/payment/payment_transaction.model";
import Wallet from "@app/models/wallet/wallet.model";
import WalletTransaction, {
  DepositStatus,
  WalletTransactionType,
} from "@app/models/wallet/wallet_transaction.model";
import MeetingRoomBooking from "@app/models/booking/meeting-room-booking.model";
import MeetingRoom from "@app/models/booking/meeting-room.model";
import { BookingStatusEnum } from "@app/enums/booking-status.enum";
import { GoogleCalendarService } from "@app/services/google-calendar.service";

export interface BarayCreateIntentResult {
  _id: string;
  url: string;
  status: string;
  expires_at: string;
  payment_transaction_id: number;
}

export interface BarayCreateWalletDepositIntentResult {
  _id: string;
  url: string;
  status: string;
  expires_at: string;
  wallet_transaction_id: number;
}

@Injectable()
export class BarayService {
  private readonly logger = new Logger(BarayService.name);
  private readonly payUrl: string;
  /** User-facing pay page, e.g. https://pay.baray.io — Baray /pay often returns only `_id`, not a full `url`. */
  private readonly payCheckoutBase: string;
  private readonly apiKey: string;
  private readonly secretB64: string;
  private readonly ivB64: string;
  private readonly currency: string;
  private readonly orderIdPrefix: string;
  private readonly walletDepositPrefix: string;
  private readonly meetingRoomBookingPrefix: string;

  constructor(
    private readonly _http: HttpService,
    private readonly _notifications: NotificationsGateway,
    @Inject(forwardRef(() => OrderService))
    private readonly _orderService: OrderService,
    private readonly _exchange: ExchangeSettingService,
    private readonly _telegram: TelegramService,
    private readonly _calendar: GoogleCalendarService,
  ) {
    // Full URL to POST (include path, e.g. https://api.baray.io/pay)
    this.payUrl = (process.env.BARAY_PAY_URL || "https://api.baray.io/pay").replace(/\/$/, "");
    this.payCheckoutBase = (process.env.BARAY_CHECKOUT_BASE_URL || "https://pay.baray.io").replace(/\/$/, "");
    this.apiKey = process.env.BARAY_API_KEY || "";
    this.secretB64 = process.env.BARAY_SK || process.env.BARAY_SECRET_KEY || "";
    this.ivB64 = process.env.BARAY_IV || "";
    this.currency = process.env.BARAY_CURRENCY || "USD";
    this.orderIdPrefix = process.env.BARAY_ORDER_ID_PREFIX || "pos-order-";
    this.walletDepositPrefix = process.env.BARAY_WALLET_DEPOSIT_ID_PREFIX || "pos-wallet-deposit-";
    this.meetingRoomBookingPrefix = process.env.BARAY_BOOKING_ID_PREFIX || "pos-booking-";
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

  makeExternalWalletDepositId(walletTransactionId: number): string {
    return `${this.walletDepositPrefix}${walletTransactionId}`;
  }

  parseWalletDepositIdFromBarayValue(decrypted: string): number | null {
    const t = (decrypted || "").trim();
    const m = t.match(
      new RegExp(`^${this.walletDepositPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`),
    );
    if (m) {
      return Number(m[1]);
    }
    try {
      const o = JSON.parse(t) as { order_id?: string };
      if (o?.order_id) {
        return this.parseWalletDepositIdFromBarayValue(o.order_id);
      }
    } catch {
      // not JSON
    }
    return null;
  }

  makeExternalMeetingRoomBookingId(bookingId: number): string {
    return `${this.meetingRoomBookingPrefix}${bookingId}`;
  }

  parseMeetingRoomBookingIdFromBarayValue(decrypted: string): number | null {
    const t = (decrypted || "").trim();
    const m = t.match(
      new RegExp(`^${this.meetingRoomBookingPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`),
    );
    if (m) {
      return Number(m[1]);
    }
    try {
      const o = JSON.parse(t) as { order_id?: string };
      if (o?.order_id) {
        return this.parseMeetingRoomBookingIdFromBarayValue(o.order_id);
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
    return this._createBarayIntentFromOrder(order, cashierId);
  }

  /**
   * Customer app: same Baray QR/link flow as cashier; order must belong to this customer.
   */
  async createIntentForCustomerOrder(
    customerId: number,
    orderId: number,
  ): Promise<BarayCreateIntentResult> {
    this._ensureConfigured();
    const order = await Order.findOne({
      where: { id: orderId, customer_id: customerId },
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    return this._createBarayIntentFromOrder(order, null);
  }

  /** Ensures `orderId` belongs to `customerId` (for polling endpoints). */
  async assertCustomerOwnsOrder(customerId: number, orderId: number): Promise<void> {
    const row = await Order.findOne({
      where: { id: orderId, customer_id: customerId },
      attributes: ["id"],
    });
    if (!row) {
      throw new NotFoundException("Order not found.");
    }
  }

  async createIntentForCustomerWalletDeposit(
    customerId: number,
    amount: number,
    note?: string,
  ): Promise<BarayCreateWalletDepositIntentResult> {
    this._ensureConfigured();
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException("Amount must be a positive number.");
    }

    const [wallet] = await Wallet.findOrCreate({
      where: { customer_id: customerId },
      defaults: { customer_id: customerId, balance: 0 },
    });

    const tx = await WalletTransaction.create({
      wallet_id: wallet.id,
      type: WalletTransactionType.DEPOSIT,
      amount: Number(amount),
      status: DepositStatus.PENDING,
      note: note ?? "baray",
    });

    const externalOrderId = this.makeExternalWalletDepositId(tx.id);
    const bodyPayload = {
      amount: this._formatAmount(Number(amount)),
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
      await tx.update({ status: DepositStatus.REJECTED, note: "baray_intent_failed" });
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
      await tx.update({ status: DepositStatus.REJECTED, note: "baray_invalid_response" });
      throw new BadRequestException(
        `Baray did not return a payment id. Response: ${
          typeof barayResBody === "string" ? barayResBody : JSON.stringify(barayResBody)
        }`.slice(0, 2_000),
      );
    }

    await tx.update({
      reference: _id,
      note: note && note.trim().length > 0 ? `baray|${note.trim()}` : "baray",
    });

    const expires = raw.expires_at
      ? new Date(raw.expires_at)
      : new Date(Date.now() + 15 * 60 * 1000);

    return {
      _id,
      url,
      status: (raw.status as string) || "pending",
      expires_at: (raw.expires_at as string) || expires.toISOString(),
      wallet_transaction_id: tx.id,
    };
  }

  /**
   * Public meeting room booking: create a Baray payment link for a booking id.
   * We store the Baray _id + pay URL on `meeting_room_bookings` (no PaymentTransaction table).
   */
  async createIntentForMeetingRoomBooking(bookingId: number): Promise<{
    data: { _id: string; url: string; status: string; expires_at: string; booking_id: number };
  }> {
    this._ensureConfigured();
    const booking = await MeetingRoomBooking.findByPk(bookingId, { include: [{ model: MeetingRoom }] });
    if (!booking) throw new NotFoundException("Booking not found.");
    if (booking.status === BookingStatusEnum.CANCELLED || booking.status === BookingStatusEnum.COMPLETED) {
      throw new BadRequestException("Payment is not available for this booking state.");
    }
    // Already paid (webhook settled)
    if (String(booking.payment_status).toLowerCase() === "success") {
      throw new BadRequestException("This booking is already paid.");
    }

    // Reuse still-valid pending link if present
    if (
      booking.baray_payment_id &&
      booking.baray_payment_url &&
      booking.baray_expires_at &&
      new Date(booking.baray_expires_at).getTime() > Date.now() &&
      String(booking.payment_status).toLowerCase() === "pending"
    ) {
      return {
        data: {
          _id: booking.baray_payment_id,
          url: booking.baray_payment_url,
          status: "pending",
          expires_at: booking.baray_expires_at.toISOString(),
          booking_id: booking.id,
        },
      };
    }

    // Amount: require room price_per_hour; compute hours from start/end (same-day only for now)
    const room = (booking as any).room as MeetingRoom | undefined;
    const pph = room?.price_per_hour != null ? Number(room.price_per_hour) : NaN;
    if (!Number.isFinite(pph) || pph <= 0) {
      throw new BadRequestException("Room price_per_hour is not configured.");
    }
    const start = booking.meeting_start_time;
    const end = booking.meeting_end_time;
    const parse = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return hh * 60 + mm;
    };
    const minutes = parse(end) - parse(start);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new BadRequestException("Invalid meeting time range.");
    }
    const hours = minutes / 60;
    const totalUsd = pph * hours * Number(booking.num_rooms ?? 1);

    const externalOrderId = this.makeExternalMeetingRoomBookingId(booking.id);
    const bodyPayload = {
      amount: this._formatAmount(totalUsd),
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

    await booking.update({
      total_amount: totalUsd,
      baray_payment_id: _id,
      baray_payment_url: url,
      baray_expires_at: expires,
      payment_status: PaymentStatus.PENDING,
    });

    return {
      data: {
        _id,
        url,
        status: (raw.status as string) || "pending",
        expires_at: (raw.expires_at as string) || expires.toISOString(),
        booking_id: booking.id,
      },
    };
  }

  async createIntentForCustomerMeetingRoomBooking(customerId: number, bookingId: number) {
    const booking = await MeetingRoomBooking.findByPk(bookingId, { attributes: ["id", "customer_id"] });
    if (!booking || Number(booking.customer_id ?? 0) !== Number(customerId)) {
      throw new NotFoundException("Booking not found.");
    }
    return this.createIntentForMeetingRoomBooking(bookingId);
  }

  async getCustomerMeetingRoomBookingPaymentState(customerId: number, bookingId: number) {
    const booking = await MeetingRoomBooking.findByPk(bookingId, { attributes: ["id", "customer_id"] });
    if (!booking || Number(booking.customer_id ?? 0) !== Number(customerId)) {
      throw new NotFoundException("Booking not found.");
    }
    return this.getMeetingRoomBookingPaymentState(bookingId);
  }

  async getMeetingRoomBookingPaymentState(bookingId: number): Promise<{
    data: {
      booking_id: number;
      booking_status: string;
      baray_transaction_status: string | null;
    };
  }> {
    const booking = await MeetingRoomBooking.findByPk(bookingId, { attributes: ["id", "status", "payment_status"] });
    if (!booking) throw new NotFoundException("Booking not found.");
    return {
      data: {
        booking_id: booking.id,
        booking_status: String(booking.status),
        baray_transaction_status: booking.payment_status != null ? String(booking.payment_status) : null,
      },
    };
  }

  async getWalletDepositPaymentState(customerId: number, walletTransactionId: number): Promise<{
    data: {
      wallet_transaction_id: number;
      wallet_transaction_status: string;
      balance: number;
    };
  }> {
    const tx = await WalletTransaction.findOne({
      where: {
        id: walletTransactionId,
        type: WalletTransactionType.DEPOSIT,
      },
      include: [{ model: Wallet, attributes: ["id", "customer_id", "balance"] }],
    });
    if (!tx || !tx.wallet || Number(tx.wallet.customer_id) !== Number(customerId)) {
      throw new NotFoundException("Wallet deposit transaction not found.");
    }
    return {
      data: {
        wallet_transaction_id: tx.id,
        wallet_transaction_status: String(tx.status),
        balance: Number(tx.wallet.balance ?? 0),
      },
    };
  }

  /**
   * Shared Baray intent: PaymentMethod.QR + note=baray, order → awaiting_payment.
   * `processed_by` is cashier id on POS; null when initiated by customer web.
   */
  private async _createBarayIntentFromOrder(
    order: Order,
    processedBy: number | null,
  ): Promise<BarayCreateIntentResult> {
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
      const isExpired =
        existingPending.expires_at != null &&
        new Date(existingPending.expires_at) < new Date();
      if (isExpired) {
        await existingPending.update({ status: PaymentStatus.EXPIRED });
        if (order.status === OrderStatusEnum.AWAITING_PAYMENT) {
          await order.update({ status: OrderStatusEnum.PENDING });
        }
      } else {
        throw new BadRequestException(
          "This order already has a pending payment. Wait for it to complete or mark it failed/expired first.",
        );
      }
    }

    const khrPerUsd = await this._exchange.getKhrPerUsd();
    const amountUsd = khrToUsdDisplay(order.total_price, khrPerUsd);

    const externalOrderId = this.makeExternalOrderId(orderId);
    const bodyPayload = {
      amount: this._formatAmount(amountUsd),
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
      processed_by: processedBy ?? undefined,
      method: PaymentMethod.QR,
      status: PaymentStatus.PENDING,
      amount: Number(order.total_price),
      reference: _id,
      note: "baray",
      expires_at: expires,
    });

    await order.update({ status: OrderStatusEnum.AWAITING_PAYMENT });

    this._notifications.emitCustomerDisplayShowBaray({
      orderId,
      url,
      amount_usd: amountUsd,
      expires_at: (raw.expires_at as string) || expires.toISOString(),
    });

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
    for (const key of ["encrypted_order_id", "encryptedOrderId", "data", "payload", "encrypted", "ciphertext"] as const) {
      const v = body[key];
      if (typeof v === "string" && v.length > 0) {
        return v;
      }
    }
    const data = body["data"];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const o = data as Record<string, unknown>;
      for (const k of ["encrypted_order_id", "encryptedOrderId", "encrypted", "data", "payload", "ciphertext"] as const) {
        const inner = o[k];
        if (typeof inner === "string" && inner.length > 0) {
          return inner;
        }
      }
    }
    return null;
  }

  private _extractPlainBarayOrderValue(body: Record<string, unknown>): string | null {
    for (const key of ["order_id", "orderId"] as const) {
      const v = body[key];
      if (typeof v === "string" && v.trim().length > 0) {
        return v;
      }
    }
    const data = body["data"];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const o = data as Record<string, unknown>;
      for (const key of ["order_id", "orderId"] as const) {
        const v = o[key];
        if (typeof v === "string" && v.trim().length > 0) {
          return v;
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
    const st = body["status"] ?? body["payment_status"] ?? body["state"];
    if (st && String(st).toLowerCase() === "failed") {
      return;
    }
    const enc = this._extractBarayEncryptedPayload(body);
    const plain = enc ? this.decrypt(enc) : this._extractPlainBarayOrderValue(body);
    if (!plain) {
      this.logger.warn(`Baray webhook missing order payload. Keys: ${Object.keys(body).join(",")}`);
      throw new BadRequestException("Missing Baray order payload.");
    }
    const walletDepositId = this.parseWalletDepositIdFromBarayValue(plain);
    if (walletDepositId != null && Number.isFinite(walletDepositId)) {
      await this._settleWalletDepositWebhook(walletDepositId);
      return;
    }

    const bookingId = this.parseMeetingRoomBookingIdFromBarayValue(plain);
    if (bookingId != null && Number.isFinite(bookingId)) {
      await this._settleMeetingRoomBookingWebhook(bookingId);
      return;
    }

    const localOrderId = this.parseLocalOrderIdFromBarayValue(plain);
    if (localOrderId == null || !Number.isFinite(localOrderId)) {
      this.logger.warn("Could not resolve local order from Baray webhook payload.");
      throw new BadRequestException("Could not resolve local order from webhook payload.");
    }
    const order = await Order.findByPk(localOrderId);
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
    const paidByRaw =
      body["payer_name"] ??
      body["paid_by"] ??
      body["customer_name"] ??
      body["account_name"] ??
      body["payer"] ??
      body["from"];
    const paidBy =
      paidByRaw != null && String(paidByRaw).trim().length > 0
        ? String(paidByRaw).trim()
        : undefined;

    const amountRaw = body["amount"] ?? body["paid_amount"] ?? body["total_amount"];
    const paidAmount =
      amountRaw != null && Number.isFinite(Number(amountRaw))
        ? Number(amountRaw)
        : Number(order.total_price ?? 0);

    try {
      await this._orderService.sendPlacedNotificationsAfterBarayPayment(localOrderId, {
        paidBy,
        paidAmount,
      });
    } catch {
      // Telegram/FCM optional; payment is already recorded
    }

    // Notify customer on Telegram that their payment was received
    try {
      const orderWithCustomer = await Order.findByPk(localOrderId, {
        attributes: ['id', 'receipt_number'],
        include: [{ model: User, as: 'customer', attributes: ['telegram_user_id'] }],
      });
      const tgId = (orderWithCustomer as any)?.customer?.telegram_user_id;
      if (tgId) {
        await this._telegram.sendHTMLToChat(
          tgId,
          `<b>Payment received</b>\nReceipt: <code>#${orderWithCustomer.receipt_number}</code>\nYour order is being prepared. Thank you!`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Customer payment notify failed order_id=${localOrderId}: ${msg}`);
    }

    this._notifications.emitBarayPaymentSuccess({
      orderId: localOrderId,
      receiptNumber: String(order.receipt_number ?? ""),
      cashierId: Number(order.cashier_id ?? 0),
    });
    this._notifications.emitCustomerDisplayClear({ orderId: localOrderId });
  }

  private async _settleWalletDepositWebhook(walletTransactionId: number): Promise<void> {
    await WalletTransaction.sequelize.transaction(async (transaction) => {
      const tx = await WalletTransaction.findByPk(walletTransactionId, {
        transaction,
        lock: true,
      });
      if (!tx) {
        throw new NotFoundException("Wallet deposit transaction not found for webhook.");
      }
      const wallet = await Wallet.findByPk(tx.wallet_id, { transaction, lock: true });
      if (!wallet) {
        throw new NotFoundException("Wallet not found for webhook deposit.");
      }
      if (tx.type !== WalletTransactionType.DEPOSIT) {
        throw new BadRequestException("Webhook target is not a deposit transaction.");
      }
      if (tx.status === DepositStatus.APPROVED) {
        return;
      }
      if (tx.status !== DepositStatus.PENDING) {
        throw new BadRequestException(`Cannot settle a ${tx.status} wallet deposit.`);
      }
      await tx.update(
        {
          status: DepositStatus.APPROVED,
        },
        { transaction },
      );
      await Wallet.increment("balance", {
        by: Number(tx.amount),
        where: { id: tx.wallet_id },
        transaction,
      });
    });
  }

  private async _settleMeetingRoomBookingWebhook(bookingId: number): Promise<void> {
    const booking = await MeetingRoomBooking.findByPk(bookingId, { include: [{ model: MeetingRoom }] });
    if (!booking) {
      throw new NotFoundException("Meeting room booking not found for webhook.");
    }
    if (String(booking.payment_status).toLowerCase() === PaymentStatus.SUCCESS) {
      return;
    }
    // Payment received; staff still confirms the reservation (admin/cashier).
    await booking.update({
      payment_status: PaymentStatus.SUCCESS,
    });

    // Create Google Calendar event (best-effort; failures should not rollback payment).
    try {
      const room = (booking as any).room as MeetingRoom | undefined;
      const eventId = await this._calendar.createEvent({
        summary: `Meeting Room: ${room?.name ?? 'Room'} — ${booking.guest_name}`,
        description: [
          `Guest: ${booking.guest_name}`,
          `Phone: ${booking.guest_phone}`,
          `Email: ${booking.guest_email}`,
          booking.guest_origin ? `From: ${booking.guest_origin}` : '',
          `Guests: ${booking.num_guests}  |  Rooms: ${booking.num_rooms}`,
          booking.purpose ? `Purpose: ${booking.purpose}` : '',
          booking.notes ? `Notes: ${booking.notes}` : '',
        ].filter(Boolean).join('\n'),
        startDateTime: `${booking.check_in_date}T${booking.meeting_start_time}:00`,
        endDateTime: `${booking.check_out_date}T${booking.meeting_end_time}:00`,
        attendeeEmails: [booking.guest_email],
      });
      if (eventId) {
        await booking.update({ google_calendar_event_id: eventId });
      }
    } catch {
      // ignore
    }
  }
}
