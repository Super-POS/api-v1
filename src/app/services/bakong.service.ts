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
import Wallet from "@app/models/wallet/wallet.model";
import WalletTransaction, {
  DepositStatus,
  WalletTransactionType,
} from "@app/models/wallet/wallet_transaction.model";
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
  /** Bakong short link — NBC hosted redirect (optional if API fails). */
  deeplink?: string | null;
  /** Full NBC payment URL with embedded KHQR (used for per-bank deep links on mobile). */
  deeplink_full?: string | null;
}

export interface BakongCreateWalletDepositIntentResult {
  qr: string;
  md5: string;
  wallet_transaction_id: number;
  expires_at: string;
  qr_amount: number;
  qr_currency: "USD" | "KHR";
  deeplink?: string | null;
  deeplink_full?: string | null;
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

/** Persist KHQR on the tx so the customer can resume the same code (note is TEXT). */
function bakongNoteWithQr(qr: string): string {
  return `${BAKONG_NOTE}\n${qr}`;
}

function parseQrFromBakongPaymentNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const raw = String(note);
  if (raw === BAKONG_NOTE) return null;
  if (raw.startsWith(`${BAKONG_NOTE}\n`)) {
    const qr = raw.slice(BAKONG_NOTE.length + 1).trim();
    return qr.length > 0 ? qr : null;
  }
  return null;
}

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

  /**
   * Customer-initiated KHQR intent (web + Telegram Mini App). Looks up the order by
   * `(id, customer_id)` so a customer can only ever generate a QR for their own order.
   */
  async createIntentForCustomerOrder(
    customerId: number,
    orderId: number,
  ): Promise<BakongCreateIntentResult> {
    this._ensureConfigured();
    const order = await Order.findOne({
      where: { id: orderId, customer_id: customerId },
    });
    if (!order) throw new NotFoundException("Order not found.");
    return this._createBakongIntentFromOrder(order, null);
  }

  /** Ownership guard for polling endpoints — same shape as `BarayService.assertCustomerOwnsOrder`. */
  async assertCustomerOwnsOrder(customerId: number, orderId: number): Promise<void> {
    const row = await Order.findOne({
      where: { id: orderId, customer_id: customerId },
      attributes: ["id"],
    });
    if (!row) {
      throw new NotFoundException("Order not found.");
    }
  }

  /**
   * Customer closed the QR modal or wants a fresh code before the server expiry window.
   * Marks any PENDING Bakong payment on this order as EXPIRED so a new intent can be created.
   */
  async abandonPendingBakongForOrder(
    customerId: number,
    orderId: number,
  ): Promise<{ data: { abandoned_count: number } }> {
    await this.assertCustomerOwnsOrder(customerId, orderId);
    const order = await Order.findByPk(orderId, { attributes: ["id", "status"] });
    if (!order || order.status !== OrderStatusEnum.AWAITING_PAYMENT) {
      return { data: { abandoned_count: 0 } };
    }
    const [abandonedCount] = await PaymentTransaction.update(
      { status: PaymentStatus.EXPIRED },
      {
        where: {
          order_id: orderId,
          note: { [Op.like]: `${BAKONG_NOTE}%` },
          status: PaymentStatus.PENDING,
        },
      },
    );
    if (abandonedCount > 0) {
      this.logger.log(`Bakong abandon: order=${orderId} expired ${abandonedCount} pending tx(s).`);
    }
    return { data: { abandoned_count: abandonedCount } };
  }

  /** Same as order abandon — for wallet top-up when the user dismisses the deposit QR. */
  async abandonPendingBakongWalletDeposit(
    customerId: number,
    walletTransactionId: number,
  ): Promise<{ data: { abandoned: boolean } }> {
    const tx = await WalletTransaction.findOne({
      where: {
        id: walletTransactionId,
        type: WalletTransactionType.DEPOSIT,
        status: DepositStatus.PENDING,
      },
      include: [{ model: Wallet, attributes: ["id", "customer_id"] }],
    });
    if (!tx || !tx.wallet || Number(tx.wallet.customer_id) !== Number(customerId)) {
      throw new NotFoundException("Wallet deposit transaction not found.");
    }
    const note = String(tx.note ?? "").toLowerCase();
    if (!this._isBakongWalletDeposit(tx) && !note.startsWith(BAKONG_NOTE)) {
      return { data: { abandoned: false } };
    }
    await tx.update({
      status: DepositStatus.REJECTED,
      note: `${String(tx.note ?? BAKONG_NOTE).split("\n")[0].split("|")[0]}|abandoned`,
    });
    this.logger.log(`Bakong abandon: wallet deposit tx=${walletTransactionId} rejected.`);
    return { data: { abandoned: true } };
  }

  /** Cancel every pending Bakong deposit for this customer (e.g. closed modal without paying). */
  async abandonAllPendingBakongWalletDeposits(
    customerId: number,
  ): Promise<{ data: { abandoned_count: number } }> {
    const wallet = await Wallet.findOne({ where: { customer_id: customerId } });
    if (!wallet) {
      return { data: { abandoned_count: 0 } };
    }

    await this._expireStalePendingWalletDeposits(wallet.id);

    const pending = await WalletTransaction.findAll({
      where: {
        wallet_id: wallet.id,
        type: WalletTransactionType.DEPOSIT,
        status: DepositStatus.PENDING,
        note: { [Op.like]: `${BAKONG_NOTE}%` },
      },
    });

    let abandonedCount = 0;
    for (const tx of pending) {
      const base = String(tx.note ?? BAKONG_NOTE).split("\n")[0].split("|")[0];
      await tx.update({
        status: DepositStatus.REJECTED,
        note: `${base}|abandoned`,
      });
      abandonedCount += 1;
    }

    if (abandonedCount > 0) {
      this.logger.log(
        `Bakong abandon: customer=${customerId} rejected ${abandonedCount} pending wallet deposit(s).`,
      );
    }
    return { data: { abandoned_count: abandonedCount } };
  }

  /**
   * Customer wallet top-up via KHQR (web + Telegram Mini App). Mirrors
   * `BarayService.createIntentForCustomerWalletDeposit` but uses Bakong polling.
   */
  async createIntentForCustomerWalletDeposit(
    customerId: number,
    amount: number,
    note?: string,
  ): Promise<BakongCreateWalletDepositIntentResult> {
    this._ensureConfigured();
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException("Amount must be a positive number.");
    }

    const [wallet] = await Wallet.findOrCreate({
      where: { customer_id: customerId },
      defaults: { customer_id: customerId, balance: 0 },
    });

    return this._createBakongIntentFromWalletDeposit(wallet.id, Number(amount), note);
  }

  /**
   * Poll wallet deposit settlement. While the tx is PENDING we call Bakong's
   * `check_transaction_by_md5` (same as order payments) and credit the wallet on success.
   */
  async getWalletDepositPaymentState(
    customerId: number,
    walletTransactionId: number,
  ): Promise<{
    data: {
      wallet_transaction_id: number;
      wallet_transaction_status: string;
      balance: number;
      bakong_response_message: string | null;
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

    let lastResponseMessage: string | null = null;
    if (this._isBakongWalletDeposit(tx) && tx.wallet) {
      await this._expireStalePendingWalletDeposits(tx.wallet.id);
      await tx.reload({ include: [{ model: Wallet, attributes: ["id", "customer_id", "balance"] }] });
    }
    if (this._isBakongWalletDeposit(tx) && tx.status === DepositStatus.PENDING && tx.reference) {
      lastResponseMessage = await this._checkAndSettleWalletDeposit(tx);
      await tx.reload({ include: [{ model: Wallet, attributes: ["id", "customer_id", "balance"] }] });
    }

    return {
      data: {
        wallet_transaction_id: tx.id,
        wallet_transaction_status: String(tx.status),
        balance: Number(tx.wallet?.balance ?? 0),
        bakong_response_message: lastResponseMessage,
      },
    };
  }

  /**
   * Background sweep: expire stale QRs and poll NBC for any pending Bakong order
   * payments and wallet deposits (so settlement works when the client is closed).
   */
  async pollAllPendingBakongSettlements(): Promise<{
    payment_checked: number;
    deposit_checked: number;
  }> {
    if (!this.merchantId) {
      return { payment_checked: 0, deposit_checked: 0 };
    }

    const now = new Date();
    await PaymentTransaction.update(
      { status: PaymentStatus.EXPIRED },
      {
        where: {
          note: { [Op.like]: `${BAKONG_NOTE}%` },
          status: PaymentStatus.PENDING,
          expires_at: { [Op.lt]: now },
        },
      },
    );

    const staleWalletDeposits = await WalletTransaction.findAll({
      where: {
        type: WalletTransactionType.DEPOSIT,
        status: DepositStatus.PENDING,
        note: { [Op.like]: `${BAKONG_NOTE}%` },
      },
    });
    for (const tx of staleWalletDeposits) {
      if (!this._isBakongWalletDeposit(tx)) continue;
      const expiresAt = this._walletDepositExpiresAt(tx);
      if (Date.now() > expiresAt.getTime()) {
        const base = String(tx.note ?? BAKONG_NOTE).split("\n")[0].split("|")[0];
        await tx.update({
          status: DepositStatus.REJECTED,
          note: `${base}|expired`,
        });
      }
    }

    const pendingPayments = await PaymentTransaction.findAll({
      where: {
        status: PaymentStatus.PENDING,
        reference: { [Op.ne]: null },
        note: { [Op.like]: `${BAKONG_NOTE}%` },
      },
      include: [{ model: Order, required: true }],
    });

    let paymentChecked = 0;
    for (const tx of pendingPayments) {
      const order = tx.order;
      if (!order) continue;
      paymentChecked += 1;
      try {
        await this._checkAndSettleTransaction(tx, order);
      } catch (e) {
        this.logger.warn(
          `Bakong background poll payment tx=${tx.id}: ${(e as Error).message}`,
        );
      }
    }

    const pendingDeposits = await WalletTransaction.findAll({
      where: {
        type: WalletTransactionType.DEPOSIT,
        status: DepositStatus.PENDING,
        reference: { [Op.ne]: null },
        note: { [Op.like]: `${BAKONG_NOTE}%` },
      },
    });

    let depositChecked = 0;
    for (const tx of pendingDeposits) {
      if (!this._isBakongWalletDeposit(tx)) continue;
      depositChecked += 1;
      try {
        await this._checkAndSettleWalletDeposit(tx);
      } catch (e) {
        this.logger.warn(
          `Bakong background poll wallet deposit tx=${tx.id}: ${(e as Error).message}`,
        );
      }
    }

    if (paymentChecked > 0 || depositChecked > 0) {
      this.logger.debug(
        `Bakong background poll: checked ${paymentChecked} order payment(s), ${depositChecked} wallet deposit(s).`,
      );
    }

    return { payment_checked: paymentChecked, deposit_checked: depositChecked };
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

    // Cashier orders are created as `pending`; we promote to `awaiting_payment` when the QR is issued.
    // Customer web orders may already be `awaiting_payment`. Block kitchen/terminal states only.
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
      where: { order_id: orderId, status: PaymentStatus.PENDING, note: { [Op.like]: `${BAKONG_NOTE}%` } },
      order: [["id", "DESC"]],
    });
    if (existingPending) {
      const cachedQr = parseQrFromBakongPaymentNote(existingPending.note);
      const expiresAt = existingPending.expires_at;
      if (
        cachedQr &&
        existingPending.reference &&
        expiresAt &&
        expiresAt.getTime() > Date.now()
      ) {
        const qrAmount = await this._amountInQrCurrency(Number(order.total_price));
        const { shortLink, fullLink } = await this._generateKhqrDeepLink(cachedQr);
        return {
          qr: cachedQr,
          md5: String(existingPending.reference),
          payment_transaction_id: existingPending.id,
          expires_at: expiresAt.toISOString(),
          qr_amount: qrAmount,
          qr_currency: this.currency,
          deeplink: shortLink,
          deeplink_full: fullLink,
        };
      }
      // Stale or broken pending row (e.g. cashier closed the QR modal) — expire so a fresh QR can be issued.
      await existingPending.update({ status: PaymentStatus.EXPIRED });
      this.logger.log(
        `Bakong: expired stale pending tx=${existingPending.id} for order=${orderId} (could not reuse cached QR).`,
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
      note: bakongNoteWithQr(qr),
      expires_at: expiresAt,
    });

    await order.update({ status: OrderStatusEnum.AWAITING_PAYMENT });

    this.logger.log(
      `Bakong intent created for order=${orderId} tx=${tx.id} amount=${qrAmount} ${this.currency} expires_at=${expiresAt.toISOString()}`,
    );

    const { shortLink, fullLink } = await this._generateKhqrDeepLink(qr);

    return {
      qr,
      md5,
      payment_transaction_id: tx.id,
      expires_at: expiresAt.toISOString(),
      qr_amount: qrAmount,
      qr_currency: this.currency,
      deeplink: shortLink,
      deeplink_full: fullLink,
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

  /**
   * NBC Bakong deep link — on mobile opens the system bank-app picker (ABA, ACLEDA, Wing, …)
   * with the KHQR pre-filled. See `bakong-khqr` README / POST `/v1/generate_deeplink_by_qr`.
   */
  private async _generateKhqrDeepLink(
    qr: string,
  ): Promise<{ shortLink: string | null; fullLink: string | null }> {
    const empty = { shortLink: null, fullLink: null };
    try {
      const url = `${this.baseUrl}/v1/generate_deeplink_by_qr`;
      const res = (await BakongKHQR.generateDeepLink(url, qr)) as {
        status?: { code?: number; message?: string };
        data?: { shortLink?: string; fullLink?: string } | null;
      };
      if (res?.status?.code === 0 && res.data) {
        const shortLink =
          typeof res.data.shortLink === "string" && res.data.shortLink.trim().length > 0
            ? res.data.shortLink.trim()
            : null;
        const fullLink =
          typeof res.data.fullLink === "string" && res.data.fullLink.trim().length > 0
            ? res.data.fullLink.trim()
            : null;
        return { shortLink, fullLink };
      }
      this.logger.warn(
        `Bakong deeplink failed: ${res?.status?.message ?? "unknown"} (QR payment still works via scan).`,
      );
      return empty;
    } catch (e) {
      this.logger.warn(
        `Bakong deeplink error: ${(e as Error).message} (QR payment still works via scan).`,
      );
      return empty;
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
      where: { order_id: orderId, note: { [Op.like]: `${BAKONG_NOTE}%` } },
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
          note: { [Op.like]: `${BAKONG_NOTE}%` },
          status: PaymentStatus.PENDING,
          expires_at: { [Op.lt]: now },
        },
      },
    );
  }

  // =========================================================================>> Wallet deposits

  private _isBakongWalletDeposit(tx: WalletTransaction): boolean {
    const note = String(tx.note ?? "").toLowerCase();
    return (
      note === BAKONG_NOTE ||
      note.startsWith(`${BAKONG_NOTE}|`) ||
      note.startsWith(`${BAKONG_NOTE}\n`)
    );
  }

  /**
   * Deposit amounts from the customer web are entered in USD (same as Baray wallet deposits).
   * Convert to the configured KHQR currency before encoding tag 54.
   */
  private async _depositAmountForQr(depositAmountUsd: number): Promise<number> {
    if (!Number.isFinite(depositAmountUsd) || depositAmountUsd <= 0) {
      throw new BadRequestException("Deposit amount must be positive.");
    }
    if (this.currency === "USD") {
      return Math.round(depositAmountUsd * 100) / 100;
    }
    const khrPerUsd = await this._exchange.getKhrPerUsd();
    if (!Number.isFinite(khrPerUsd) || khrPerUsd <= 0) {
      throw new BadRequestException("Cannot convert deposit — exchange rate is unavailable.");
    }
    return Math.round(depositAmountUsd * khrPerUsd);
  }

  private _walletDepositExpired(tx: WalletTransaction, expiresAt: Date): boolean {
    return Date.now() > expiresAt.getTime();
  }

  private _walletDepositExpiresAt(tx: WalletTransaction): Date {
    const created = tx.created_at ? new Date(tx.created_at) : new Date();
    return new Date(created.getTime() + this.qrExpiryMs);
  }

  private async _expireStalePendingWalletDeposits(walletId: number): Promise<void> {
    const pending = await WalletTransaction.findAll({
      where: {
        wallet_id: walletId,
        type: WalletTransactionType.DEPOSIT,
        status: DepositStatus.PENDING,
        note: { [Op.like]: `${BAKONG_NOTE}%` },
      },
    });
    const now = Date.now();
    for (const tx of pending) {
      if (!this._isBakongWalletDeposit(tx)) continue;
      const expiresAt = this._walletDepositExpiresAt(tx);
      if (now > expiresAt.getTime()) {
        const base = String(tx.note ?? BAKONG_NOTE).split("\n")[0].split("|")[0];
        await tx.update({
          status: DepositStatus.REJECTED,
          note: `${base}|expired`,
        });
      }
    }
  }

  private async _createBakongIntentFromWalletDeposit(
    walletId: number,
    amountUsd: number,
    note?: string,
  ): Promise<BakongCreateWalletDepositIntentResult> {
    await this._expireStalePendingWalletDeposits(walletId);

    const existingPending = await WalletTransaction.findOne({
      where: {
        wallet_id: walletId,
        type: WalletTransactionType.DEPOSIT,
        status: DepositStatus.PENDING,
        note: { [Op.like]: `${BAKONG_NOTE}%` },
      },
      order: [["id", "DESC"]],
    });
    if (existingPending && this._isBakongWalletDeposit(existingPending)) {
      const cachedQr = parseQrFromBakongPaymentNote(existingPending.note);
      const expiresAt = this._walletDepositExpiresAt(existingPending);
      if (
        cachedQr &&
        existingPending.reference &&
        !this._walletDepositExpired(existingPending, expiresAt)
      ) {
        const qrAmount = await this._depositAmountForQr(Number(existingPending.amount));
        const { shortLink, fullLink } = await this._generateKhqrDeepLink(cachedQr);
        return {
          qr: cachedQr,
          md5: String(existingPending.reference),
          wallet_transaction_id: existingPending.id,
          expires_at: expiresAt.toISOString(),
          qr_amount: qrAmount,
          qr_currency: this.currency,
          deeplink: shortLink,
          deeplink_full: fullLink,
        };
      }
      throw new BadRequestException(
        "You already have a pending Bakong deposit. Complete or cancel it before starting another.",
      );
    }

    const expiresAt = new Date(Date.now() + this.qrExpiryMs);
    const qrAmount = await this._depositAmountForQr(amountUsd);

    const tx = await WalletTransaction.create({
      wallet_id: walletId,
      type: WalletTransactionType.DEPOSIT,
      amount: amountUsd,
      status: DepositStatus.PENDING,
      note: note && note.trim().length > 0 ? `${BAKONG_NOTE}|${note.trim()}` : BAKONG_NOTE,
    });

    const individualInfo = new IndividualInfo(
      this.merchantId,
      this.merchantName,
      this.merchantCity,
      {
        currency: this._getCurrencyCode(),
        amount: qrAmount,
        billNumber: `DEPOSIT-${tx.id}`,
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
      await tx.update({ status: DepositStatus.REJECTED, note: "bakong_qr_failed" });
      throw new BadRequestException(
        `Failed to generate KHQR: ${result.status.message ?? "unknown error"}`,
      );
    }

    const { qr, md5 } = result.data;
    await tx.update({ reference: md5, note: bakongNoteWithQr(qr) });

    this.logger.log(
      `Bakong wallet deposit intent walletTx=${tx.id} amount=${qrAmount} ${this.currency} expires_at=${expiresAt.toISOString()}`,
    );

    const { shortLink, fullLink } = await this._generateKhqrDeepLink(qr);

    return {
      qr,
      md5,
      wallet_transaction_id: tx.id,
      expires_at: expiresAt.toISOString(),
      qr_amount: qrAmount,
      qr_currency: this.currency,
      deeplink: shortLink,
      deeplink_full: fullLink,
    };
  }

  private async _checkAndSettleWalletDeposit(tx: WalletTransaction): Promise<string | null> {
    const expiresAt = this._walletDepositExpiresAt(tx);
    if (this._walletDepositExpired(tx, expiresAt)) {
      const base = String(tx.note ?? BAKONG_NOTE).split("\n")[0].split("|")[0];
      await tx.update({
        status: DepositStatus.REJECTED,
        note: `${base}|expired`,
      });
      this.logger.log(`Bakong wallet tx=${tx.id} expired before settlement.`);
      return "QR expired before payment was received.";
    }

    try {
      await this._ensureValidToken();
    } catch (e) {
      this.logger.warn(`Bakong token unavailable during wallet deposit poll: ${(e as Error).message}`);
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
        await this._markWalletDepositPaid(tx, body);
        return message || "Deposit confirmed.";
      }

      if (body?.responseCode === 1) {
        const lower = message.toLowerCase();
        if (lower.includes("could not be found") || lower.includes("not found")) {
          return message;
        }
        if (lower.includes("failed")) {
          const base = String(tx.note ?? BAKONG_NOTE).split("\n")[0].split("|")[0];
          await tx.update({
            status: DepositStatus.REJECTED,
            note: `${base}|failed`,
          });
          this.logger.warn(`Bakong wallet tx=${tx.id} marked REJECTED: ${message}`);
          return message;
        }
      }

      this.logger.warn(
        `Bakong wallet tx=${tx.id} unexpected response responseCode=${body?.responseCode} message="${message}"`,
      );
      return message || null;
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 401) {
        this.token = "";
        this.logger.warn("Bakong returned 401 — clearing cached token; next poll will renew.");
      }
      this.logger.warn(`Bakong wallet check_transaction_by_md5 error: ${(e as Error).message}`);
      return null;
    }
  }

  private async _markWalletDepositPaid(
    tx: WalletTransaction,
    body: BakongApiResponse,
  ): Promise<void> {
    await WalletTransaction.sequelize.transaction(async (transaction) => {
      const locked = await WalletTransaction.findByPk(tx.id, { transaction, lock: true });
      if (!locked) {
        throw new NotFoundException("Wallet deposit transaction not found.");
      }
      if (locked.status === DepositStatus.APPROVED) {
        return;
      }
      if (locked.status !== DepositStatus.PENDING) {
        throw new BadRequestException(`Cannot settle a ${locked.status} wallet deposit.`);
      }
      const wallet = await Wallet.findByPk(locked.wallet_id, { transaction, lock: true });
      if (!wallet) {
        throw new NotFoundException("Wallet not found for deposit settlement.");
      }
      await locked.update({ status: DepositStatus.APPROVED }, { transaction });
      await Wallet.increment("balance", {
        by: Number(locked.amount),
        where: { id: locked.wallet_id },
        transaction,
      });
    });
    const txData = (body.data ?? {}) as {
      hash?: string;
      fromAccountId?: string;
      amount?: number;
      currency?: string;
    };
    this.logger.log(
      `Bakong wallet tx=${tx.id} APPROVED — from=${txData.fromAccountId ?? "?"} ` +
        `amount=${txData.amount ?? "?"} ${txData.currency ?? "?"} hash=${txData.hash ?? "?"}`,
    );
  }
}
