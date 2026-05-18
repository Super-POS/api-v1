// ===========================================================================>> Core Library
import { Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import Wallet            from '@app/models/wallet/wallet.model';
import WalletTransaction, { DepositStatus, WalletTransactionType } from '@app/models/wallet/wallet_transaction.model';
import User              from '@app/models/user/user.model';
import { RequestDepositDto } from './dto';

const BAKONG_DEPOSIT_NOTE = 'bakong';

@Injectable()
export class CustomerWalletService {

    // ==========================================>> Get wallet balance + recent transactions
    async getWallet(customer_id: number): Promise<any> {
        const [wallet] = await Wallet.findOrCreate({
            where   : { customer_id },
            defaults: { customer_id, balance: 0 },
        });

        const transactions = await WalletTransaction.findAll({
            where  : { wallet_id: wallet.id },
            include: [{ model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false }],
            order  : [['created_at', 'DESC']],
            limit  : 20,
        });

        return {
            data: {
                id          : wallet.id,
                balance     : Number(wallet.balance),
                transactions,
            },
        };
    }

    // ==========================================>> Request a deposit (customer self-serve)
    async requestDeposit(customer_id: number, body: RequestDepositDto): Promise<any> {
        const [wallet] = await Wallet.findOrCreate({
            where   : { customer_id },
            defaults: { customer_id, balance: 0 },
        });

        const tx = await WalletTransaction.create({
            wallet_id : wallet.id,
            type      : WalletTransactionType.DEPOSIT,
            amount    : body.amount,
            status    : DepositStatus.PENDING,
            reference : body.reference ?? null,
            note      : body.note ?? null,
        });

        const data = await WalletTransaction.findByPk(tx.id);
        return { data, message: 'Deposit request has been submitted and is pending approval.' };
    }

    /** Which payment rail created this pending deposit (for polling routing). */
    async getDepositChannel(
        customerId: number,
        walletTransactionId: number,
    ): Promise<'bakong' | 'baray' | 'other'> {
        const tx = await WalletTransaction.findOne({
            where: {
                id: walletTransactionId,
                type: WalletTransactionType.DEPOSIT,
            },
            include: [{ model: Wallet, attributes: ['customer_id'] }],
        });
        if (!tx?.wallet || Number(tx.wallet.customer_id) !== Number(customerId)) {
            throw new NotFoundException('Wallet deposit transaction not found.');
        }
        const note = String(tx.note ?? '').toLowerCase();
        if (
            note === BAKONG_DEPOSIT_NOTE ||
            note.startsWith(`${BAKONG_DEPOSIT_NOTE}|`) ||
            note.startsWith(`${BAKONG_DEPOSIT_NOTE}\n`)
        ) {
            return 'bakong';
        }
        if (note === 'baray' || note.startsWith('baray|')) {
            return 'baray';
        }
        return 'other';
    }

    // ==========================================>> Deposit / transaction history
    async getHistory(customer_id: number, page = 1, limit = 10): Promise<any> {
        const wallet = await Wallet.findOne({ where: { customer_id } });
        if (!wallet) {
            return { data: [], pagination: { page, limit, totalPage: 0, total: 0 } };
        }

        const offset = (page - 1) * limit;

        const { rows, count } = await WalletTransaction.findAndCountAll({
            where  : { wallet_id: wallet.id },
            include: [{ model: User, as: 'processor', attributes: ['id', 'name', 'avatar'], required: false }],
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
}
