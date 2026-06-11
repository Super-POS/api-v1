// ===========================================================================>> Core Library
import { Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import Stamp from '@app/models/loyalty/stamp.model';
import { CreateStampDto, UpdateStampDto } from './dto';

@Injectable()
export class AdminStampService {

    async list(): Promise<Stamp[]> {
        return Stamp.findAll({ order: [['id', 'ASC']] });
    }

    async findOne(id: number): Promise<Stamp> {
        const stamp = await Stamp.findByPk(id);
        if (!stamp) throw new NotFoundException(`Stamp #${id} not found.`);
        return stamp;
    }

    async create(body: CreateStampDto): Promise<Stamp> {
        return Stamp.create({
            name              : body.name.trim(),
            description       : body.description?.trim() ?? null,
            category          : body.category,
            trigger_condition : body.trigger_condition?.trim() ?? null,
            points_bonus      : body.points_bonus ?? 0,
            icon              : body.icon?.trim() ?? null,
        } as any);
    }

    async update(id: number, body: UpdateStampDto): Promise<Stamp> {
        const stamp = await this.findOne(id);

        await stamp.update({
            ...(body.name              !== undefined && { name: body.name.trim() }),
            ...(body.description       !== undefined && { description: body.description?.trim() ?? null }),
            ...(body.category          !== undefined && { category: body.category }),
            ...(body.trigger_condition !== undefined && { trigger_condition: body.trigger_condition?.trim() ?? null }),
            ...(body.points_bonus      !== undefined && { points_bonus: body.points_bonus }),
            ...(body.icon              !== undefined && { icon: body.icon?.trim() ?? null }),
            ...(body.is_active         !== undefined && { is_active: body.is_active }),
        });

        return stamp.reload();
    }

    async remove(id: number): Promise<void> {
        const stamp = await this.findOne(id);
        await stamp.destroy();
    }
}
