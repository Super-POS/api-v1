// ===========================================================================>> Core Library
import { Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import Mission                             from '@app/models/loyalty/mission.model';
import Stamp                               from '@app/models/loyalty/stamp.model';
import CustomerMission                     from '@app/models/loyalty/customer_mission.model';
import User                                from '@app/models/user/user.model';
import { CreateMissionDto, UpdateMissionDto } from './dto';

@Injectable()
export class AdminMissionService {

    async list(): Promise<Mission[]> {
        return Mission.findAll({
            include: [{ model: Stamp, as: 'reward_stamp', attributes: ['id', 'name', 'icon', 'category'] }],
            order  : [['id', 'ASC']],
        });
    }

    async findOne(id: number): Promise<Mission> {
        const mission = await Mission.findByPk(id, {
            include: [{ model: Stamp, as: 'reward_stamp' }],
        });
        if (!mission) throw new NotFoundException(`Mission #${id} not found.`);
        return mission;
    }

    async create(body: CreateMissionDto): Promise<Mission> {
        const row = await Mission.create({
            name                     : body.name.trim(),
            description              : body.description?.trim() ?? null,
            requirement_type         : body.requirement_type,
            target_value             : body.target_value,
            reward_points            : body.reward_points ?? 0,
            reward_stamp_id          : body.reward_stamp_id ?? null,
            status                   : body.status ?? 'draft',
            start_date               : body.start_date ? new Date(body.start_date) : null,
            end_date                 : body.end_date   ? new Date(body.end_date)   : null,
            max_completions_per_user : body.max_completions_per_user ?? null,
            icon                     : body.icon?.trim() ?? null,
        } as any);

        return row.reload({ include: [{ model: Stamp, as: 'reward_stamp' }] });
    }

    async update(id: number, body: UpdateMissionDto): Promise<Mission> {
        const mission = await this.findOne(id);

        await mission.update({
            ...(body.name                     !== undefined && { name: body.name.trim() }),
            ...(body.description              !== undefined && { description: body.description?.trim() ?? null }),
            ...(body.requirement_type         !== undefined && { requirement_type: body.requirement_type }),
            ...(body.target_value             !== undefined && { target_value: body.target_value }),
            ...(body.reward_points            !== undefined && { reward_points: body.reward_points }),
            ...(body.reward_stamp_id          !== undefined && { reward_stamp_id: body.reward_stamp_id ?? null }),
            ...(body.status                   !== undefined && { status: body.status }),
            ...(body.start_date               !== undefined && { start_date: body.start_date ? new Date(body.start_date) : null }),
            ...(body.end_date                 !== undefined && { end_date: body.end_date ? new Date(body.end_date) : null }),
            ...(body.max_completions_per_user !== undefined && { max_completions_per_user: body.max_completions_per_user ?? null }),
            ...(body.icon                     !== undefined && { icon: body.icon?.trim() ?? null }),
        });

        return mission.reload({ include: [{ model: Stamp, as: 'reward_stamp' }] });
    }

    async remove(id: number): Promise<void> {
        const mission = await this.findOne(id);
        await mission.destroy();
    }

    async listParticipants(id: number): Promise<CustomerMission[]> {
        await this.findOne(id);

        return CustomerMission.findAll({
            where  : { mission_id: id },
            include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'avatar'] }],
            order  : [['updated_at', 'DESC']],
        });
    }
}
