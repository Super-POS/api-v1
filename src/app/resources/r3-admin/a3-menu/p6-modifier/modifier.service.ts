// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
// ===========================================================================>> Third party Library
import { Op } from 'sequelize';
// ===========================================================================>> Custom Library
import Menu from '@app/models/menu/menu.model';
import MenuModifierGroup from '@app/models/menu/menu-modifier-group.model';
import ModifierGroup from '@app/models/menu/modifier-group.model';
import ModifierOption from '@app/models/menu/modifier-option.model';
import {
    CreateModifierGroupDto,
    CreateModifierOptionDto,
    SetMenuModifiersDto,
    UpdateModifierGroupDto,
    UpdateModifierOptionDto,
} from './modifier.dto';

@Injectable()
export class ModifierAdminService {
    private async _buildUniqueGroupCode(name: string, preferred?: string, excludeId?: number): Promise<string> {
        const baseRaw = (preferred || name || 'modifier').trim().toLowerCase();
        const base = baseRaw
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 60) || 'modifier';
        let candidate = base;
        let i = 2;
        while (true) {
            const where: Record<string, unknown> = { code: candidate };
            if (excludeId != null) {
                where['id'] = { [Op.ne]: excludeId };
            }
            const exists = await ModifierGroup.findOne({ where });
            if (!exists) {
                return candidate;
            }
            candidate = `${base}_${i++}`;
        }
    }

    // ------------------------------------------------------------------ groups
    async listGroups() {
        const rows = await ModifierGroup.findAll({
            order: [['sort_order', 'ASC'], ['id', 'ASC']],
            include: [
                {
                    model: ModifierOption,
                    as: 'options',
                    required: false,
                    separate: true,
                    order: [['sort_order', 'ASC'], ['id', 'ASC']],
                },
            ],
        });
        return { data: rows };
    }

    async createGroup(dto: CreateModifierGroupDto) {
        const code = await this._buildUniqueGroupCode(dto.name, dto.code);
        const row = await ModifierGroup.create({
            name: dto.name,
            code,
            sort_order: dto.sort_order ?? 0,
            is_active: dto.is_active ?? true,
        });
        return { data: row, message: 'Modifier group created.' };
    }

    async updateGroup(id: number, dto: UpdateModifierGroupDto) {
        const row = await ModifierGroup.findByPk(id);
        if (!row) {
            throw new NotFoundException('Modifier group not found.');
        }
        const payload: Record<string, unknown> = { ...dto };
        if ((dto.name != null && dto.name !== row.name) || (dto.code != null && dto.code !== row.code)) {
            payload['code'] = await this._buildUniqueGroupCode(
                String(dto.name ?? row.name),
                dto.code ?? row.code,
                id,
            );
        }
        await row.update({
            ...payload,
        });
        return { data: await ModifierGroup.findByPk(id, { include: [{ model: ModifierOption, as: 'options' }] }), message: 'Modifier group updated.' };
    }

    async deleteGroup(id: number) {
        const row = await ModifierGroup.findByPk(id);
        if (!row) {
            throw new NotFoundException('Modifier group not found.');
        }
        try {
            await row.destroy();
        } catch (e: any) {
            const msg = e?.message || String(e);
            throw new BadRequestException(
                `Cannot delete this modifier group. Remove it from all menus, delete or reassign its options, then try again. (${msg})`,
            );
        }
        return { message: 'Modifier group deleted.' };
    }

    // ------------------------------------------------------------------ options
    async createOption(groupId: number, dto: CreateModifierOptionDto) {
        const g = await ModifierGroup.findByPk(groupId);
        if (!g) {
            throw new NotFoundException('Modifier group not found.');
        }
        const row = await ModifierOption.create({
            group_id: groupId,
            label: dto.label,
            code: dto.code,
            price_delta: dto.price_delta ?? 0,
            sort_order: dto.sort_order ?? 0,
            is_active: dto.is_active ?? true,
            is_default: dto.is_default ?? false,
            ingredient_recipe: dto.ingredient_recipe?.map((l) => ({
                ingredient_id: Number(l.ingredient_id),
                quantity: Number(l.quantity),
            })) ?? [],
        });
        return { data: row, message: 'Option created.' };
    }

    async updateOption(id: number, dto: UpdateModifierOptionDto) {
        const row = await ModifierOption.findByPk(id);
        if (!row) {
            throw new NotFoundException('Modifier option not found.');
        }
        const payload: Record<string, unknown> = { ...dto };
        if (dto.ingredient_recipe != null) {
            payload['ingredient_recipe'] = dto.ingredient_recipe.map((l) => ({
                ingredient_id: Number(l.ingredient_id),
                quantity: Number(l.quantity),
            }));
        }
        await row.update(payload);
        return { data: await ModifierOption.findByPk(id), message: 'Option updated.' };
    }

    async deleteOption(id: number) {
        const row = await ModifierOption.findByPk(id);
        if (!row) {
            throw new NotFoundException('Modifier option not found.');
        }
        try {
            await row.destroy();
        } catch (e: any) {
            const msg = e?.message || String(e);
            throw new BadRequestException(
                `Cannot delete this option. It may be referenced on past orders. Deactivate it instead, or run DB cleanup. (${msg})`,
            );
        }
        return { message: 'Option deleted.' };
    }

    // ------------------------------------------------------------------ menu assignments
    async getMenuAssignments(menuId: number) {
        const menu = await Menu.findByPk(menuId);
        if (!menu) {
            throw new NotFoundException('Menu not found.');
        }
        const links = await MenuModifierGroup.findAll({
            where: { menu_id: menuId },
            include: [
                {
                    model: ModifierGroup,
                    as: 'modifierGroup',
                    include: [{ model: ModifierOption, as: 'options' }],
                },
            ],
            order: [['sort_order', 'ASC']],
        });
        return {
            data: links.map((l) => ({
                modifier_group_id: l.modifier_group_id,
                sort_order: l.sort_order,
                is_required: l.is_required,
                group: l.modifierGroup,
            })),
        };
    }

    async setMenuAssignments(menuId: number, dto: SetMenuModifiersDto) {
        const menu = await Menu.findByPk(menuId);
        if (!menu) {
            throw new NotFoundException('Menu not found.');
        }
        const groupIds = dto.items.map((i) => i.modifier_group_id);
        const existing = await ModifierGroup.findAll({ where: { id: { [Op.in]: groupIds } } });
        if (existing.length !== groupIds.length) {
            throw new BadRequestException('One or more modifier groups do not exist.');
        }
        await MenuModifierGroup.destroy({ where: { menu_id: menuId } });
        for (const item of dto.items) {
            await MenuModifierGroup.create({
                menu_id: menuId,
                modifier_group_id: item.modifier_group_id,
                sort_order: item.sort_order,
                is_required: item.is_required ?? false,
            });
        }
        return this.getMenuAssignments(menuId);
    }
}
