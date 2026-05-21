import { randomBytes } from 'crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import Coupon from '@app/models/coupon/coupon.model';
import CouponAssignedUser from '@app/models/coupon/coupon_assigned_user.model';
import CouponMenu from '@app/models/coupon/coupon_menu.model';
import CouponCategory from '@app/models/coupon/coupon_category.model';
import User from '@app/models/user/user.model';
import Menu from '@app/models/menu/menu.model';
import MenuType from '@app/models/menu/menu-type.model';
import { CreateCouponDto, UpdateCouponDto } from './dto';

function normalizeCouponCode(code: string): string {
    return code.trim().toUpperCase();
}

const GENERATED_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCouponCodeCandidate(length: number): string {
    const buf = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += GENERATED_CODE_ALPHABET[buf[i] % GENERATED_CODE_ALPHABET.length];
    }
    return out;
}

const FULL_INCLUDE = [
    {
        model: CouponAssignedUser,
        as: 'assignments',
        required: false,
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
    },
    {
        model: CouponMenu,
        as: 'menu_restrictions',
        required: false,
        include: [{ model: Menu, as: 'menu', attributes: ['id', 'name', 'code'] }],
    },
    {
        model: CouponCategory,
        as: 'category_restrictions',
        required: false,
        include: [{ model: MenuType, as: 'category', attributes: ['id', 'name'] }],
    },
];

@Injectable()
export class AdminCouponService {
    async list(): Promise<{ data: Coupon[] }> {
        const data = await Coupon.findAll({ order: [['id', 'DESC']], include: FULL_INCLUDE });
        return { data };
    }

    private async generateUniqueCouponCode(maxAttempts = 24): Promise<string> {
        for (let i = 0; i < maxAttempts; i++) {
            const candidate = randomCouponCodeCandidate(10);
            const exists = await Coupon.findOne({ where: { code: candidate } });
            if (!exists) return candidate;
        }
        throw new BadRequestException('Could not generate a unique coupon code. Try again.');
    }

    async create(body: CreateCouponDto): Promise<{ data: Coupon; message: string }> {
        let code: string;
        if (body.auto_generate_code === true) {
            code = await this.generateUniqueCouponCode();
        } else {
            const raw = body.code?.trim();
            if (!raw) throw new BadRequestException('Coupon code is required unless auto-generate is enabled.');
            code = normalizeCouponCode(raw);
            const exists = await Coupon.findOne({ where: { code } });
            if (exists) throw new BadRequestException('A coupon with this code already exists.');
        }

        const note = body.note != null && String(body.note).trim() !== '' ? String(body.note).trim() : null;
        const row = await Coupon.create({
            code,
            discount_percent: body.discount_percent,
            is_active: body.is_active !== false,
            note,
            usage_limit: body.usage_limit ?? null,
            expires_at: body.expires_at ? new Date(body.expires_at) : null,
        });

        await this._syncRestrictions(row.id, body);

        await row.reload({ include: FULL_INCLUDE });
        const message = body.auto_generate_code === true ? `Coupon created with code ${row.code}.` : 'Coupon created.';
        return { data: row, message };
    }

    async update(id: number, body: UpdateCouponDto): Promise<{ data: Coupon; message: string }> {
        const row = await Coupon.findByPk(id);
        if (!row) throw new NotFoundException('Coupon not found.');

        const patch: Partial<Coupon> = {};
        if (body.discount_percent != null) patch.discount_percent = body.discount_percent;
        if (body.is_active !== undefined) patch.is_active = body.is_active;
        if (body.code != null && body.code.trim() !== '') {
            const code = normalizeCouponCode(body.code);
            const clash = await Coupon.findOne({ where: { code, id: { [Op.ne]: id } } });
            if (clash) throw new BadRequestException('Another coupon already uses this code.');
            patch.code = code;
        }
        if (body.note !== undefined) {
            patch.note = body.note != null && String(body.note).trim() !== '' ? String(body.note).trim() : null;
        }
        if (body.usage_limit !== undefined) patch.usage_limit = body.usage_limit ?? null;
        if (body.expires_at !== undefined) patch.expires_at = body.expires_at ? new Date(body.expires_at) : null;

        await row.update(patch);
        await this._syncRestrictions(id, body, true);
        await row.reload({ include: FULL_INCLUDE });
        return { data: row, message: 'Coupon updated.' };
    }

    async remove(id: number): Promise<{ message: string }> {
        const n = await Coupon.destroy({ where: { id } });
        if (n === 0) throw new NotFoundException('Coupon not found.');
        return { message: 'Coupon deleted.' };
    }

    /** Syncs all four restriction junction tables. Pass `isUpdate=true` to do full replace. */
    private async _syncRestrictions(
        couponId: number,
        body: CreateCouponDto | UpdateCouponDto,
        isUpdate = false,
    ): Promise<void> {
        if (body.assigned_user_ids !== undefined || !isUpdate) {
            if (isUpdate) await CouponAssignedUser.destroy({ where: { coupon_id: couponId } });
            if (body.assigned_user_ids?.length) {
                await CouponAssignedUser.bulkCreate(
                    body.assigned_user_ids.map((uid) => ({ coupon_id: couponId, user_id: uid })),
                    { ignoreDuplicates: true },
                );
            }
        }

        if (body.menu_ids !== undefined || !isUpdate) {
            if (isUpdate) await CouponMenu.destroy({ where: { coupon_id: couponId } });
            if (body.menu_ids?.length) {
                await CouponMenu.bulkCreate(
                    body.menu_ids.map((mid) => ({ coupon_id: couponId, menu_id: mid })),
                    { ignoreDuplicates: true },
                );
            }
        }

        if (body.category_ids !== undefined || !isUpdate) {
            if (isUpdate) await CouponCategory.destroy({ where: { coupon_id: couponId } });
            if (body.category_ids?.length) {
                await CouponCategory.bulkCreate(
                    body.category_ids.map((cid) => ({ coupon_id: couponId, category_id: cid })),
                    { ignoreDuplicates: true },
                );
            }
        }
    }
}
