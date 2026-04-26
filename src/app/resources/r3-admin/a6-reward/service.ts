// ===========================================================================>> Core Library
import { BadRequestException, Injectable } from '@nestjs/common';

// ===========================================================================>> Custom Library
import RewardPoint       from '@app/models/reward/reward_point.model';
import RewardTransaction from '@app/models/reward/reward_transaction.model';
import User              from '@app/models/user/user.model';
import { RewardEngineService } from '@app/services/reward-engine.service';

@Injectable()
export class AdminRewardService {

    constructor(private readonly _engine: RewardEngineService) {}

    // ==========================================>> List all reward transactions (paginated)
    async getData(page = 1, limit = 10, customer_id?: number): Promise<any> {
        const offset   = (page - 1) * limit;
        const where: any = {};
        if (customer_id) where.customer_id = customer_id;

        const { rows, count } = await RewardTransaction.findAndCountAll({
            where,
            include: [
                { model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] },
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

    // ==========================================>> View reward profile of a customer
    async viewCustomer(customer_id: number): Promise<any> {
        // Trigger expiry before reading balance
        await this._engine.expireForCustomer(customer_id);

        const rewardPoint = await RewardPoint.findOne({
            where  : { customer_id },
            include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'avatar', 'phone'] }],
        });

        if (!rewardPoint) {
            const customer = await User.findByPk(customer_id, {
                attributes: ['id', 'name', 'avatar', 'phone'],
            });
            if (!customer) throw new BadRequestException('Customer is not found.');
            return { data: { customer, balance: 0, transactions: [] } };
        }

        const transactions = await RewardTransaction.findAll({
            where : { customer_id },
            order : [['created_at', 'DESC']],
            limit : 20,
        });

        return { data: { ...rewardPoint.toJSON(), transactions } };
    }
}
