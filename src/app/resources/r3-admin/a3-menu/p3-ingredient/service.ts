// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import ProductIngredient from '@app/models/product/ingredient.model';
import { CreateProductIngredientDto, UpdateProductIngredientDto } from './dto';

@Injectable()
export class ProductIngredientService {

    // ==========================================>> list
    async getData(): Promise<any> {
        try {
            const data = await ProductIngredient.findAll({
                attributes: ['id', 'product_id', 'name', 'unit', 'quantity', 'created_at'],
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/menu/ingredient/getData', error);
        }
    }

    // ==========================================>> view one
    async view(id: number): Promise<any> {
        const data = await ProductIngredient.findByPk(id, {
            attributes: ['id', 'product_id', 'name', 'unit', 'quantity', 'created_at'],
        });

        if (!data) {
            throw new NotFoundException('Menu ingredient is not found.');
        }

        return { data };
    }

    // ==========================================>> create
    async create(body: CreateProductIngredientDto): Promise<any> {
        const data = await ProductIngredient.create({
            name: body.name,
            unit: body.unit ?? null,
            quantity: body.quantity,
        });

        return {
            data,
            message: 'Menu ingredient has been created.',
        };
    }

    // ==========================================>> update
    async update(body: UpdateProductIngredientDto, id: number): Promise<any> {
        const checkedData = await ProductIngredient.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Menu ingredient is not found.');
        }

        await ProductIngredient.update(
            { name: body.name, unit: body.unit ?? null, quantity: body.quantity },
            { where: { id } }
        );

        const data = await ProductIngredient.findByPk(id);

        return {
            data,
            message: 'Menu ingredient has been updated.',
        };
    }

    // ==========================================>> delete
    async delete(id: number): Promise<any> {
        const checkedData = await ProductIngredient.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Menu ingredient is not found.');
        }

        await ProductIngredient.destroy({ where: { id } });

        return { message: 'Data has been deleted successfully.' };
    }
}
