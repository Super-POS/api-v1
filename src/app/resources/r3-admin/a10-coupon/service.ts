import { randomBytes } from 'crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import Coupon from '@app/models/coupon/coupon.model';
import CouponAssignedUser from '@app/models/coupon/coupon_assigned_user.model';
import User from '@app/models/user/user.model';
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

const ASSIGNMENTS_INCLUDE = {
    model: CouponAssignedUser,
    as: 'assignments',
    required: false,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
};

@Injectable()
export class AdminCouponService {
    async list(): Promise<{ data: Coupon[] }> {
        const data = await Coupon.findAll({
            order: [['id', 'DESC']],
            include: [ASSIGNMENTS_INCLUDE],
        });
        return { data };
    }

    private async generateUniqueCouponCode(maxAttempts = 24): Promise<string> {
        for (let i = 0; i < maxAttempts; i++) {
            const candidate = randomCouponCodeCandidate(10);
            const exists = await Coupon.findOne({ where: { code: candidate } });
            if (!exists) {
                return candidate;
            }
        }
        throw new BadRequestException('Could not generate a unique coupon code. Try again.');
    }

    async create(body: CreateCouponDto): Promise<{ data: Coupon; message: string }> {
        let code: string;
        if (body.auto_generate_code === true) {
            code = await this.generateUniqueCouponCode();
        } else {
            const raw = body.code?.trim();
            if (!raw) {
                throw new BadRequestException('Coupon code is required unless auto-generate is enabled.');
            }
            code = normalizeCouponCode(raw);
            const exists = await Coupon.findOne({ where: { code } });
            if (exists) {
                throw new BadRequestException('A coupon with this code already exists.');
            }
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

        if (body.assigned_user_ids?.length) {
            await CouponAssignedUser.bulkCreate(
                body.assigned_user_ids.map((userId) => ({ coupon_id: row.id, user_id: userId })),
                { ignoreDuplicates: true },
            );
        }

        await row.reload({ include: [ASSIGNMENTS_INCLUDE] });
        const message = body.auto_generate_code === true ? `Coupon created with code ${row.code}.` : 'Coupon created.';
        return { data: row, message };
    }

    async update(id: number, body: UpdateCouponDto): Promise<{ data: Coupon; message: string }> {
        const row = await Coupon.findByPk(id);
        if (!row) {
            throw new NotFoundException('Coupon not found.');
        }
        const patch: Partial<Coupon> = {};
        if (body.discount_percent != null) {
            patch.discount_percent = body.discount_percent;
        }
        if (body.is_active !== undefined) {
            patch.is_active = body.is_active;
        }
        if (body.code != null && body.code.trim() !== '') {
            const code = normalizeCouponCode(body.code);
            const clash = await Coupon.findOne({ where: { code, id: { [Op.ne]: id } } });
            if (clash) {
                throw new BadRequestException('Another coupon already uses this code.');
            }
            patch.code = code;
        }
        if (body.note !== undefined) {
            patch.note = body.note != null && String(body.note).trim() !== '' ? String(body.note).trim() : null;
        }
        if (body.usage_limit !== undefined) {
            patch.usage_limit = body.usage_limit ?? null;
        }
        if (body.expires_at !== undefined) {
            patch.expires_at = body.expires_at ? new Date(body.expires_at) : null;
        }
        await row.update(patch);

        if (body.assigned_user_ids !== undefined) {
            await CouponAssignedUser.destroy({ where: { coupon_id: id } });
            if (body.assigned_user_ids.length > 0) {
                await CouponAssignedUser.bulkCreate(
                    body.assigned_user_ids.map((userId) => ({ coupon_id: id, user_id: userId })),
                    { ignoreDuplicates: true },
                );
            }
        }

        await row.reload({ include: [ASSIGNMENTS_INCLUDE] });
        return { data: row, message: 'Coupon updated.' };
    }

    async remove(id: number): Promise<{ message: string }> {
        const n = await Coupon.destroy({ where: { id } });
        if (n === 0) {
            throw new NotFoundException('Coupon not found.');
        }
        return { message: 'Coupon deleted.' };
    }
}
