// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService } from '@app/services/audit-log.service';
import ProductIngredient from '@app/models/product/ingredient.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/product/stock_movement.model';
import User from '@app/models/user/user.model';
import { CreateStockMovementDto } from './dto';

@Injectable()
export class StockMovementService {

    constructor(private readonly auditLog: AuditLogService) {}

    // ==========================================>> list (optionally filter by ingredient)
    async getData(ingredient_id?: number): Promise<any> {
        try {
            const where = ingredient_id ? { ingredient_id } : {};
            const data = await IngredientStockMovement.findAll({
                where,
                attributes: ['id', 'ingredient_id', 'type', 'quantity', 'note', 'created_by', 'created_at'],
                include: [
                    { model: ProductIngredient, attributes: ['id', 'name', 'unit', 'quantity'] },
                    { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
                ],
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/menu/stock-movement/getData', error);
        }
    }

    // ==========================================>> view one
    async view(id: number): Promise<any> {
        const data = await IngredientStockMovement.findByPk(id, {
            attributes: ['id', 'ingredient_id', 'type', 'quantity', 'note', 'created_by', 'created_at'],
            include: [
                { model: ProductIngredient, attributes: ['id', 'name', 'unit', 'quantity'] },
                { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        if (!data) {
            throw new NotFoundException('Stock movement record is not found.');
        }

        return { data };
    }

    // ==========================================>> create (records the movement and adjusts ingredient quantity)
    async create(body: CreateStockMovementDto, created_by?: number): Promise<any> {
        const ingredient = await ProductIngredient.findByPk(body.ingredient_id);
        if (!ingredient) {
            throw new NotFoundException('Ingredient is not found.');
        }

        const delta = body.type === StockMovementType.IN ? body.quantity : -body.quantity;
        const newQty = Number(ingredient.quantity) + delta;

        if (newQty < 0) {
            throw new BadRequestException('Insufficient stock quantity for this operation.');
        }

        const movement = await IngredientStockMovement.create({
            ingredient_id: body.ingredient_id,
            type:          body.type,
            quantity:      body.quantity,
            note:          body.note ?? null,
            created_by:    created_by ?? null,
        });

        await ProductIngredient.update({ quantity: newQty }, { where: { id: body.ingredient_id } });

        const data = await IngredientStockMovement.findByPk(movement.id, {
            attributes: ['id', 'ingredient_id', 'type', 'quantity', 'note', 'created_by', 'created_at'],
            include: [
                { model: ProductIngredient, attributes: ['id', 'name', 'unit', 'quantity'] },
                { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        if (created_by) {
            await this.auditLog.log(created_by, 'STOCK_ADJUSTMENT', {
                movementId   : movement.id,
                ingredientId : body.ingredient_id,
                ingredientName: ingredient.name,
                type         : body.type,
                quantity     : body.quantity,
                note         : body.note ?? null,
                newStock     : newQty,
            });
        }

        return {
            data,
            message: 'Stock movement has been recorded.',
        };
    }

    // ==========================================>> delete
    async delete(id: number): Promise<any> {
        const record = await IngredientStockMovement.findByPk(id, {
            include: [{ model: ProductIngredient }],
        });
        if (!record) {
            throw new NotFoundException('Stock movement record is not found.');
        }

        // Reverse the effect on ingredient quantity
        const ingredient = record.ingredient;
        const delta = record.type === StockMovementType.IN ? -record.quantity : record.quantity;
        const newQty = Number(ingredient.quantity) + delta;

        if (newQty < 0) {
            throw new BadRequestException('Reversing this movement would result in negative stock.');
        }

        await ProductIngredient.update({ quantity: newQty }, { where: { id: record.ingredient_id } });
        await IngredientStockMovement.destroy({ where: { id } });

        return { message: 'Stock movement has been deleted and quantity reversed.' };
    }
}
