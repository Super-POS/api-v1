// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import Order               from '@app/models/order/order.model';
import OrderDetails        from '@app/models/order/detail.model';
import Product             from '@app/models/product/product.model';
import PaymentTransaction, { PaymentMethod, PaymentStatus } from '@app/models/payment/payment_transaction.model';
import User                from '@app/models/user/user.model';
import { InitiatePaymentDto } from './dto';

// Pending QR / online payments expire after this many minutes
const EXPIRY_MINUTES = 15;

@Injectable()
export class CustomerPaymentService {

    // ==========================================>> Initiate a payment for an order
    async initiate(customer_id: number, body: InitiatePaymentDto): Promise<any> {
        const order = await Order.findOne({
            where  : { id: body.order_id, customer_id },
            include: [
                {
                    model     : OrderDetails,
                    attributes: ['id', 'unit_price', 'qty'],
                    include   : [{ model: Product, attributes: ['id', 'name'] }],
                },
            ],
        });

        if (!order) throw new NotFoundException('Order is not found.');

        // Only one active pending payment allowed per order
        const existing = await PaymentTransaction.findOne({
            where: { order_id: order.id, status: PaymentStatus.PENDING },
        });
        if (existing) throw new BadRequestException('This order already has a pending payment. Cancel or wait for it to expire first.');

        // Auto-calculate expiry for non-cash methods
        const expiresAt = body.method !== PaymentMethod.CASH
            ? new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000)
            : null;

        const tx = await PaymentTransaction.create({
            order_id   : order.id,
            customer_id,
            method     : body.method,
            status     : PaymentStatus.PENDING,
            amount     : order.total_price,
            reference  : body.reference ?? null,
            note       : body.note ?? null,
            expires_at : expiresAt,
        });

        const data = await PaymentTransaction.findByPk(tx.id, {
            include: [
                { model: Order, attributes: ['id', 'receipt_number', 'total_price', 'status', 'channel'] },
            ],
        });

        return {
            data,
            message: `Payment initiated via ${body.method}.${expiresAt ? ` Expires at ${expiresAt.toISOString()}.` : ''}`,
        };
    }

    // ==========================================>> Get payment status for a specific order
    async getByOrder(order_id: number, customer_id: number): Promise<any> {
        const order = await Order.findOne({ where: { id: order_id, customer_id } });
        if (!order) throw new NotFoundException('Order is not found.');

        const transactions = await PaymentTransaction.findAll({
            where  : { order_id },
            include: [
                { model: Order,      attributes: ['id', 'receipt_number', 'total_price', 'status'] },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
            ],
            order  : [['created_at', 'DESC']],
        });

        return { data: transactions };
    }

    // ==========================================>> My payment history (all orders)
    async getHistory(customer_id: number, page = 1, limit = 10): Promise<any> {
        const offset = (page - 1) * limit;

        const { rows, count } = await PaymentTransaction.findAndCountAll({
            where  : { customer_id },
            include: [
                { model: Order, attributes: ['id', 'receipt_number', 'total_price', 'status', 'channel'] },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
            ],
            order  : [['created_at', 'DESC']],
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

    // ==========================================>> Check if a pending payment has expired and update it
    async checkExpiry(id: number, customer_id: number): Promise<any> {
        const tx = await PaymentTransaction.findOne({ where: { id, customer_id } });
        if (!tx) throw new NotFoundException('Payment transaction is not found.');

        if (tx.status === PaymentStatus.PENDING && tx.expires_at && tx.expires_at < new Date()) {
            await tx.update({ status: PaymentStatus.EXPIRED });
            return { data: tx, message: 'Payment has expired.' };
        }

        return { data: tx, message: `Payment status: ${tx.status}.` };
    }
}
