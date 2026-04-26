// ===========================================================================>> Core Library
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import ProductIngredient from '@app/models/product/ingredient.model';
import Product from '@app/models/product/product.model';
import ProductRecipe from '@app/models/product/recipe.model';
import { CreateProductRecipeDto, UpdateProductRecipeDto } from './dto';

@Injectable()
export class ProductRecipeService {

    // ==========================================>> list all (optionally filter by product)
    async getData(product_id?: number): Promise<any> {
        try {
            const where = product_id ? { product_id } : {};
            const data = await ProductRecipe.findAll({
                where,
                attributes: ['id', 'product_id', 'ingredient_id', 'quantity', 'created_at'],
                include: [
                    { model: Product,           attributes: ['id', 'name', 'code'] },
                    { model: ProductIngredient, attributes: ['id', 'name', 'unit'] },
                ],
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/menu/recipe/getData', error);
        }
    }

    // ==========================================>> view one
    async view(id: number): Promise<any> {
        const data = await ProductRecipe.findByPk(id, {
            attributes: ['id', 'product_id', 'ingredient_id', 'quantity', 'created_at'],
            include: [
                { model: Product,           attributes: ['id', 'name', 'code'] },
                { model: ProductIngredient, attributes: ['id', 'name', 'unit'] },
            ],
        });

        if (!data) {
            throw new NotFoundException('Recipe is not found.');
        }

        return { data };
    }

    // ==========================================>> create
    async create(body: CreateProductRecipeDto): Promise<any> {
        const product = await Product.findByPk(body.product_id);
        if (!product) {
            throw new NotFoundException('Product is not found.');
        }

        const ingredient = await ProductIngredient.findByPk(body.ingredient_id);
        if (!ingredient) {
            throw new NotFoundException('Ingredient is not found.');
        }

        const existing = await ProductRecipe.findOne({
            where: { product_id: body.product_id, ingredient_id: body.ingredient_id },
        });
        if (existing) {
            throw new ConflictException('This ingredient is already linked to the product recipe.');
        }

        const data = await ProductRecipe.create({
            product_id:    body.product_id,
            ingredient_id: body.ingredient_id,
            quantity:      body.quantity,
        });

        return {
            data,
            message: 'Recipe has been created.',
        };
    }

    // ==========================================>> update
    async update(body: UpdateProductRecipeDto, id: number): Promise<any> {
        const checkedData = await ProductRecipe.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Recipe is not found.');
        }

        await ProductRecipe.update({ quantity: body.quantity }, { where: { id } });

        const data = await ProductRecipe.findByPk(id, {
            attributes: ['id', 'product_id', 'ingredient_id', 'quantity', 'created_at'],
            include: [
                { model: Product,           attributes: ['id', 'name', 'code'] },
                { model: ProductIngredient, attributes: ['id', 'name', 'unit'] },
            ],
        });

        return {
            data,
            message: 'Recipe has been updated.',
        };
    }

    // ==========================================>> delete
    async delete(id: number): Promise<any> {
        const checkedData = await ProductRecipe.findByPk(id);
        if (!checkedData) {
            throw new NotFoundException('Recipe is not found.');
        }

        await ProductRecipe.destroy({ where: { id } });

        return { message: 'Recipe has been deleted successfully.' };
    }
}
