// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import { CreateMenuIngredientDto, UpdateMenuIngredientDto } from './dto';

@Injectable()
export class MenuIngredientService {

    // ==========================================>> list
    async getData(): Promise<any> {
        try {
            const data = await MenuIngredient.findAll({
                attributes: ['id', 'menu_id', 'name', 'unit', 'quantity', 'low_stock_threshold', 'created_at'],
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/menu/ingredient/getData', error);
        }
    }

    // ==========================================>> view one
    async view(id: number): Promise<any> {
        const data = await MenuIngredient.findByPk(id, {
            attributes: ['id', 'menu_id', 'name', 'unit', 'quantity', 'low_stock_threshold', 'created_at'],
        });

        if (!data) {
            throw new NotFoundException('Menu ingredient is not found.');
        }

        return { data };
    }

    // ==========================================>> create
    async create(body: CreateMenuIngredientDto): Promise<any> {
        const data = await MenuIngredient.create({
            name: body.name,
            unit: body.unit ?? null,
            quantity: body.quantity,
            low_stock_threshold: body.low_stock_threshold ?? 1000,
        });

        return {
            data,
            message: 'Menu ingredient has been created.',
        };
    }

    // ==========================================>> update
    async update(body: UpdateMenuIngredientDto, id: number): Promise<any> {
        const checkedData = await MenuIngredient.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Menu ingredient is not found.');
        }

        await MenuIngredient.update(
            {
                name: body.name,
                unit: body.unit ?? null,
                quantity: body.quantity,
                low_stock_threshold: body.low_stock_threshold ?? 1000,
            },
            { where: { id } },
        );

        const data = await MenuIngredient.findByPk(id);

        return {
            data,
            message: 'Menu ingredient has been updated.',
        };
    }

    // ==========================================>> delete
    async delete(id: number): Promise<any> {
        const checkedData = await MenuIngredient.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Menu ingredient is not found.');
        }

        await MenuIngredient.destroy({ where: { id } });

        return { message: 'Data has been deleted successfully.' };
    }

    /** Ingredients at or below their configured low-stock level (for restock list). */
    async getRestockList(): Promise<{ data: MenuIngredient[] }> {
        try {
            const all = await MenuIngredient.findAll({
                attributes: ['id', 'menu_id', 'name', 'unit', 'quantity', 'low_stock_threshold', 'created_at'],
                order: [['name', 'ASC']],
            });
            const data = all.filter(
                (r) => Number(r.quantity) <= Number(r.low_stock_threshold ?? 1000),
            );
            return { data };
        } catch (error) {
            throw new BadRequestException('admin/menu/ingredient/restock', error);
        }
    }
}
