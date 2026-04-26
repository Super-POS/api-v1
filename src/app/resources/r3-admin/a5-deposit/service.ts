// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import Wallet                          from '@app/models/wallet/wallet.model';
import WalletTransaction, { DepositStatus, WalletTransactionType } from '@app/models/wallet/wallet_transaction.model';
import User                            from '@app/models/user/user.model';
import { CreateDepositDto, DepositQueryDto, ReviewDepositDto } from './dto';

@Injectable()
export class AdminDepositService {

    // ==========================================>> List all deposit requests
    async getData(query: DepositQueryDto): Promise<any> {
        const page       = Number(query.page  ?? 1);
        const limit      = Number(query.limit ?? 10);
        const offset     = (page - 1) * limit;

        const where: any = { type: WalletTransactionType.DEPOSIT };
        if (query.status)      where.status = query.status;

        const walletWhere: any = {};
        if (query.customer_id) walletWhere.customer_id = query.customer_id;

        const { rows, count } = await WalletTransaction.findAndCountAll({
            where,
            include: [
                {
                    model  : Wallet,
                    where  : walletWhere,
                    include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] }],
                },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
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

    // ==========================================>> View one deposit request
    async view(id: number): Promise<any> {
        const data = await WalletTransaction.findByPk(id, {
            include: [
                {
                    model  : Wallet,
                    include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] }],
                },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        if (!data) throw new NotFoundException('Deposit record is not found.');
        return { data };
    }

    // ==========================================>> Create a deposit on behalf of a customer (admin-initiated)
    async create(body: CreateDepositDto, adminId: number): Promise<any> {
        const [wallet] = await Wallet.findOrCreate({
            where   : { customer_id: body.customer_id },
            defaults: { customer_id: body.customer_id, balance: 0 },
        });

        const transaction = await WalletTransaction.create({
            wallet_id   : wallet.id,
            type        : WalletTransactionType.DEPOSIT,
            amount      : body.amount,
            status      : DepositStatus.PENDING,
            reference   : body.reference ?? null,
            note        : body.note ?? null,
            processed_by: adminId,
        });

        const data = await WalletTransaction.findByPk(transaction.id, {
            include: [
                {
                    model  : Wallet,
                    include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] }],
                },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        return { data, message: 'Deposit request has been created.' };
    }

    // ==========================================>> Approve a pending deposit
    async approve(id: number, body: ReviewDepositDto, adminId: number): Promise<any> {
        const tx = await WalletTransaction.findByPk(id, { include: [Wallet] });
        if (!tx)                                throw new NotFoundException('Deposit record is not found.');
        if (tx.status !== DepositStatus.PENDING) throw new BadRequestException('Only pending deposits can be approved.');

        await tx.update({
            status      : DepositStatus.APPROVED,
            processed_by: adminId,
            note        : body.note ?? tx.note,
        });

        // Credit wallet balance
        await Wallet.increment('balance', { by: Number(tx.amount), where: { id: tx.wallet_id } });

        const data = await WalletTransaction.findByPk(id, {
            include: [
                {
                    model  : Wallet,
                    include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] }],
                },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        return { data, message: 'Deposit has been approved and wallet credited.' };
    }

    // ==========================================>> Reject a pending deposit
    async reject(id: number, body: ReviewDepositDto, adminId: number): Promise<any> {
        const tx = await WalletTransaction.findByPk(id);
        if (!tx)                                throw new NotFoundException('Deposit record is not found.');
        if (tx.status !== DepositStatus.PENDING) throw new BadRequestException('Only pending deposits can be rejected.');

        await tx.update({
            status      : DepositStatus.REJECTED,
            processed_by: adminId,
            note        : body.note ?? tx.note,
        });

        const data = await WalletTransaction.findByPk(id, {
            include: [
                {
                    model  : Wallet,
                    include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] }],
                },
                { model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        return { data, message: 'Deposit has been rejected.' };
    }
}
