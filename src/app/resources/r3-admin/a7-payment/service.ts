// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService } from '@app/services/audit-log.service';
import Order               from '@app/models/order/order.model';
import PaymentTransaction, { PaymentMethod, PaymentStatus } from '@app/models/payment/payment_transaction.model';
import Wallet              from '@app/models/wallet/wallet.model';
import WalletTransaction, { DepositStatus, WalletTransactionType } from '@app/models/wallet/wallet_transaction.model';
import User                from '@app/models/user/user.model';
import { PaymentQueryDto, UpdatePaymentStatusDto } from './dto';

@Injectable()
export class AdminPaymentService {

    constructor(private readonly auditLog: AuditLogService) {}

    // ==========================================>> List payment transactions
    async getData(query: PaymentQueryDto): Promise<any> {
        const page   = Number(query.page  ?? 1);
        const limit  = Number(query.limit ?? 10);
        const offset = (page - 1) * limit;

        const where: any = {};
        if (query.status)      where.status      = query.status;
        if (query.order_id)    where.order_id    = query.order_id;
        if (query.customer_id) where.customer_id = query.customer_id;

        const { rows, count } = await PaymentTransaction.findAndCountAll({
            where,
            include: [
                { model: Order, attributes: ['id', 'receipt_number', 'total_price', 'status', 'channel'] },
                { model: User, as: 'customer',  attributes: ['id', 'name', 'avatar', 'phone'], required: false },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'],          required: false },
            ],
            order : [['created_at', 'DESC']],
            limit,
            offset,
        });

        return {
            data: rows,
            pagination: {
                page,
                limit,
                totalPage: Math.ceil(count / limit),
                total    : count,
            },
        };
    }

    // ==========================================>> View one payment transaction
    async view(id: number): Promise<any> {
        const data = await PaymentTransaction.findByPk(id, {
            include: [
                { model: Order, attributes: ['id', 'receipt_number', 'total_price', 'status', 'channel'] },
                { model: User, as: 'customer',  attributes: ['id', 'name', 'avatar', 'phone'], required: false },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'],          required: false },
            ],
        });

        if (!data) throw new NotFoundException('Payment transaction is not found.');
        return { data };
    }

    // ==========================================>> Mark as success
    async markSuccess(id: number, body: UpdatePaymentStatusDto, adminId: number): Promise<any> {
        const tx = await PaymentTransaction.findByPk(id, { include: [Order] });
        if (!tx) throw new NotFoundException('Payment transaction is not found.');

        if (tx.status !== PaymentStatus.PENDING) {
            throw new BadRequestException(`Cannot mark a ${tx.status} transaction as success.`);
        }

        await tx.update({
            status      : PaymentStatus.SUCCESS,
            paid_at     : new Date(),
            processed_by: adminId,
            note        : body.note ?? tx.note,
        });

        // If paid via wallet, debit the customer wallet and log it
        if (tx.method === PaymentMethod.WALLET && tx.customer_id) {
            const wallet = await Wallet.findOne({ where: { customer_id: tx.customer_id } });
            if (!wallet || Number(wallet.balance) < Number(tx.amount)) {
                throw new BadRequestException('Customer has insufficient wallet balance.');
            }
            await Wallet.decrement('balance', { by: Number(tx.amount), where: { id: wallet.id } });
            await WalletTransaction.create({
                wallet_id   : wallet.id,
                type        : WalletTransactionType.PAYMENT,
                amount      : tx.amount,
                status      : DepositStatus.APPROVED,
                reference   : tx.order.receipt_number,
                note        : `Payment for order #${tx.order.receipt_number}`,
                processed_by: adminId,
            });
        }

        await this.auditLog.log(adminId, 'PAYMENT_MARKED_SUCCESS', {
            paymentId : id,
            method    : tx.method,
            amount    : Number(tx.amount),
            orderId   : tx.order_id,
        });

        return { data: await this._reload(id), message: 'Payment marked as success.' };
    }

    // ==========================================>> Mark as failed
    async markFailed(id: number, body: UpdatePaymentStatusDto, adminId: number): Promise<any> {
        const tx = await PaymentTransaction.findByPk(id);
        if (!tx) throw new NotFoundException('Payment transaction is not found.');

        if (tx.status !== PaymentStatus.PENDING) {
            throw new BadRequestException(`Cannot mark a ${tx.status} transaction as failed.`);
        }

        await tx.update({
            status      : PaymentStatus.FAILED,
            paid_at     : new Date(),
            processed_by: adminId,
            note        : body.note ?? tx.note,
        });

        await this.auditLog.log(adminId, 'PAYMENT_MARKED_FAILED', {
            paymentId: id,
            orderId  : tx.order_id,
            amount   : Number(tx.amount),
        });

        return { data: await this._reload(id), message: 'Payment marked as failed.' };
    }

    // ==========================================>> Mark as expired
    async markExpired(id: number, body: UpdatePaymentStatusDto, adminId: number): Promise<any> {
        const tx = await PaymentTransaction.findByPk(id);
        if (!tx) throw new NotFoundException('Payment transaction is not found.');

        if (tx.status !== PaymentStatus.PENDING) {
            throw new BadRequestException(`Cannot mark a ${tx.status} transaction as expired.`);
        }

        await tx.update({
            status      : PaymentStatus.EXPIRED,
            processed_by: adminId,
            note        : body.note ?? tx.note,
        });

        await this.auditLog.log(adminId, 'PAYMENT_MARKED_EXPIRED', {
            paymentId: id,
            orderId  : tx.order_id,
            amount   : Number(tx.amount),
        });

        return { data: await this._reload(id), message: 'Payment marked as expired.' };
    }

    // ==========================================>> Bulk-expire stale pending transactions
    async expireStale(): Promise<any> {
        const now = new Date();
        const [affected] = await PaymentTransaction.update(
            { status: PaymentStatus.EXPIRED },
            {
                where: {
                    status    : PaymentStatus.PENDING,
                    expires_at: { $lt: now } as any,
                },
            },
        );

        return { message: `${affected} pending payment(s) have been expired.` };
    }

    // ==========================================>> Private reload helper
    private async _reload(id: number): Promise<PaymentTransaction> {
        return PaymentTransaction.findByPk(id, {
            include: [
                { model: Order, attributes: ['id', 'receipt_number', 'total_price', 'status', 'channel'] },
                { model: User, as: 'customer',  attributes: ['id', 'name', 'avatar', 'phone'], required: false },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'],          required: false },
            ],
        });
    }
}
