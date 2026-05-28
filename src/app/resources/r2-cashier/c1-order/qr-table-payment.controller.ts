// ===========================================================================>> Core Library
import { BadRequestException, Body, Controller, Injectable, NotFoundException, Post } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator from '@app/core/decorators/user.decorator';
import User from '@app/models/user/user.model';
import Order from '@app/models/order/order.model';
import PaymentTransaction, { PaymentMethod, PaymentStatus } from '@app/models/payment/payment_transaction.model';
import { OrderStatusEnum } from '@app/enums/order-status.enum';
import { QrTablePayDto } from './dto';

@Injectable()
export class QrTablePaymentService {

    async pay(cashierId: number, body: QrTablePayDto): Promise<{ data: PaymentTransaction; message: string }> {
        const order = await Order.findByPk(body.order_id, {
            attributes: ['id', 'total_price', 'status', 'receipt_number'],
        });
        if (!order) throw new NotFoundException('Order not found.');

        if (order.status === OrderStatusEnum.CANCELLED) {
            throw new BadRequestException('Cannot record payment for a cancelled order.');
        }

        const existing = await PaymentTransaction.findOne({
            where: { order_id: order.id, status: PaymentStatus.SUCCESS },
        });
        if (existing) {
            throw new BadRequestException('This order already has a successful payment recorded.');
        }

        const tx = await PaymentTransaction.create({
            order_id    : order.id,
            processed_by: cashierId,
            method      : PaymentMethod.QR_TABLE,
            status      : PaymentStatus.SUCCESS,
            amount      : order.total_price,
            note        : body.bank_name,
            paid_at     : new Date(),
        });

        return {
            data   : tx,
            message: `Payment recorded — customer scanned ${body.bank_name} QR on table.`,
        };
    }
}

/** Manual QR-on-table payment — cashier confirms the customer scanned a bank QR, no gateway required. */
@Controller('qr-table')
export class QrTablePaymentController {

    constructor(private readonly _service: QrTablePaymentService) {}

    /**
     * POST /api/cashier/ordering/qr-table/pay
     * Cashier selects which bank the customer scanned and confirms payment immediately.
     * Creates a SUCCESS PaymentTransaction with method=qr_table.
     */
    @Post('pay')
    async pay(@Body() body: QrTablePayDto, @UserDecorator() user: User) {
        return await this._service.pay(user.id, body);
    }
}
