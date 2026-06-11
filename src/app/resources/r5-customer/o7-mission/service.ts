// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';

// ===========================================================================>> Custom Library
import Mission, { MissionStatus }        from '@app/models/loyalty/mission.model';
import CustomerMission, { CustomerMissionStatus } from '@app/models/loyalty/customer_mission.model';
import CustomerStamp, { StampSource }    from '@app/models/loyalty/customer_stamp.model';
import Stamp                             from '@app/models/loyalty/stamp.model';

@Injectable()
export class CustomerMissionService {

    // ─── Available missions (active, within date range) with the customer's progress ───

    async listAvailable(customerId: number): Promise<object[]> {
        const now = new Date();

        const missions = await Mission.findAll({
            where: {
                status    : MissionStatus.ACTIVE,
                [Op.and]  : [
                    { [Op.or]: [{ start_date: null }, { start_date: { [Op.lte]: now } }] },
                    { [Op.or]: [{ end_date: null },   { end_date:   { [Op.gte]: now } }] },
                ],
            },
            include: [{ model: Stamp, as: 'reward_stamp', attributes: ['id', 'name', 'icon', 'category'] }],
            order  : [['id', 'ASC']],
        });

        const customerMissions = await CustomerMission.findAll({
            where: {
                customer_id : customerId,
                mission_id  : { [Op.in]: missions.map(m => m.id) },
            },
        });

        const progressMap = new Map(customerMissions.map(cm => [cm.mission_id, cm]));

        return missions.map(m => {
            const progress = progressMap.get(m.id);
            return {
                ...m.toJSON(),
                my_progress : progress?.progress ?? 0,
                my_status   : progress?.status   ?? null,
                accepted    : !!progress,
            };
        });
    }

    // ─── Accept / join a mission ──────────────────────────────────────────────

    async accept(customerId: number, missionId: number): Promise<CustomerMission> {
        const mission = await Mission.findOne({
            where: {
                id     : missionId,
                status : MissionStatus.ACTIVE,
            },
        });
        if (!mission) throw new NotFoundException(`Mission #${missionId} not found or is not active.`);

        // Check if already accepted and still in progress
        const existing = await CustomerMission.findOne({
            where: {
                customer_id : customerId,
                mission_id  : missionId,
                status      : CustomerMissionStatus.IN_PROGRESS,
            },
        });
        if (existing) throw new BadRequestException('You have already accepted this mission.');

        // Enforce max completions per user
        if (mission.max_completions_per_user !== null) {
            const completedCount = await CustomerMission.count({
                where: {
                    customer_id : customerId,
                    mission_id  : missionId,
                    status      : CustomerMissionStatus.COMPLETED,
                },
            });
            if (completedCount >= mission.max_completions_per_user) {
                throw new BadRequestException('You have already completed this mission the maximum number of times.');
            }
        }

        return CustomerMission.create({
            customer_id : customerId,
            mission_id  : missionId,
            progress    : 0,
            status      : CustomerMissionStatus.IN_PROGRESS,
        } as any);
    }

    // ─── My missions (with progress) ─────────────────────────────────────────

    async myMissions(customerId: number): Promise<CustomerMission[]> {
        return CustomerMission.findAll({
            where  : { customer_id: customerId },
            include: [{
                model     : Mission,
                as        : 'mission',
                include   : [{ model: Stamp, as: 'reward_stamp', attributes: ['id', 'name', 'icon'] }],
            }],
            order  : [['updated_at', 'DESC']],
        });
    }

    // ─── My stamp collection ──────────────────────────────────────────────────

    async myStamps(customerId: number): Promise<CustomerStamp[]> {
        return CustomerStamp.findAll({
            where  : { customer_id: customerId },
            include: [
                { model: Stamp,   as: 'stamp',   attributes: ['id', 'name', 'icon', 'category', 'description'] },
                { model: Mission, as: 'mission',  attributes: ['id', 'name'] },
            ],
            order  : [['earned_date', 'DESC']],
        });
    }

    // ─── Issue a stamp manually (used internally or from admin trigger) ───────

    async issueStamp(customerId: number, stampId: number, missionId: number | null, source: StampSource): Promise<CustomerStamp> {
        const stamp = await Stamp.findByPk(stampId);
        if (!stamp || !stamp.is_active) throw new NotFoundException(`Stamp #${stampId} not found.`);

        return CustomerStamp.create({
            customer_id : customerId,
            stamp_id    : stampId,
            mission_id  : missionId ?? null,
            source,
            earned_date : new Date(),
        } as any);
    }
}
