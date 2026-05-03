import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import Coupon from '@app/models/coupon/coupon.model';
import { CreateCouponDto, UpdateCouponDto } from './dto';

function normalizeCouponCode(code: string): string {
    return code.trim().toUpperCase();
}

@Injectable()
export class AdminCouponService {
    async list(): Promise<{ data: Coupon[] }> {
        const data = await Coupon.findAll({ order: [['id', 'DESC']] });
        return { data };
    }

    async create(body: CreateCouponDto): Promise<{ data: Coupon; message: string }> {
        const code = normalizeCouponCode(body.code);
        const exists = await Coupon.findOne({ where: { code } });
        if (exists) {
            throw new BadRequestException('A coupon with this code already exists.');
        }
        const note = body.note != null && String(body.note).trim() !== '' ? String(body.note).trim() : null;
        const row = await Coupon.create({
            code,
            discount_percent: body.discount_percent,
            is_active: body.is_active !== false,
            note,
        });
        return { data: row, message: 'Coupon created.' };
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
            const clash = await Coupon.findOne({
                where: { code, id: { [Op.ne]: id } },
            });
            if (clash) {
                throw new BadRequestException('Another coupon already uses this code.');
            }
            patch.code = code;
        }
        if (body.note !== undefined) {
            patch.note = body.note != null && String(body.note).trim() !== '' ? String(body.note).trim() : null;
        }
        await row.update(patch);
        await row.reload();
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
