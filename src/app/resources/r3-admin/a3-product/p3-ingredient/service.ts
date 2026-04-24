// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import ProductIngredient from '@app/models/product/ingredient.model';
import Product from '@app/models/product/product.model';
import { CreateProductIngredientDto, UpdateProductIngredientDto } from './dto';

@Injectable()
export class ProductIngredientService {

    // ==========================================>> list (optionally filter by product_id)
    async getData(product_id?: number): Promise<any> {
        try {
            const data = await ProductIngredient.findAll({
                attributes: ['id', 'product_id', 'name', 'unit', 'quantity', 'created_at'],
                include: [
                    {
                        model: Product,
                        attributes: ['id', 'name', 'code'],
                    }
                ],
                where: product_id ? { product_id } : undefined,
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/product/ingredient/getData', error);
        }
    }

    // ==========================================>> view one
    async view(id: number): Promise<any> {
        const data = await ProductIngredient.findByPk(id, {
            attributes: ['id', 'product_id', 'name', 'unit', 'quantity', 'created_at'],
            include: [
                {
                    model: Product,
                    attributes: ['id', 'name', 'code'],
                }
            ],
        });

        if (!data) {
            throw new NotFoundException('Product ingredient is not found.');
        }

        return { data };
    }

    // ==========================================>> create
    async create(body: CreateProductIngredientDto): Promise<any> {
        const product = await Product.findByPk(body.product_id);
        if (!product) {
            throw new NotFoundException(`Product with id ${body.product_id} is not found.`);
        }

        const data = await ProductIngredient.create({
            product_id: body.product_id,
            name: body.name,
            unit: body.unit ?? null,
            quantity: body.quantity,
        });

        return {
            data,
            message: 'Product ingredient has been created.',
        };
    }

    // ==========================================>> update
    async update(body: UpdateProductIngredientDto, id: number): Promise<any> {
        const checkedData = await ProductIngredient.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Product ingredient is not found.');
        }

        await ProductIngredient.update(
            { name: body.name, unit: body.unit ?? null, quantity: body.quantity },
            { where: { id } }
        );

        const data = await ProductIngredient.findByPk(id);

        return {
            data,
            message: 'Product ingredient has been updated.',
        };
    }

    // ==========================================>> delete
    async delete(id: number): Promise<any> {
        const checkedData = await ProductIngredient.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Product ingredient is not found.');
        }

        await ProductIngredient.destroy({ where: { id } });

        return { message: 'Data has been deleted successfully.' };
    }
}
