import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import Ingredient from '@app/models/product/ingredient.model';
import { CreateIngredientDto, UpdateIngredientDto } from './dto';

@Injectable()
export class IngredientService {
  async list(): Promise<{ data: Ingredient[] }> {
    const rows = await Ingredient.findAll({
      attributes: ['id', 'name', 'unit', 'stock', 'low_stock_threshold', 'created_at', 'updated_at'],
      order: [['name', 'ASC']],
    });
    return { data: rows };
  }

  async create(body: CreateIngredientDto): Promise<{ data: Ingredient; message: string }> {
    const existing = await Ingredient.findOne({ where: { name: { [Op.iLike]: body.name } } });
    if (existing) {
      throw new BadRequestException('An ingredient with this name already exists.');
    }
    const row = await Ingredient.create({
      name: body.name,
      unit: body.unit,
      stock: body.stock,
      low_stock_threshold: body.low_stock_threshold ?? 0,
    });
    return { data: row, message: 'Ingredient has been created.' };
  }

  async update(id: number, body: UpdateIngredientDto): Promise<{ data: Ingredient; message: string }> {
    const row = await Ingredient.findByPk(id);
    if (!row) {
      throw new NotFoundException('Ingredient not found.');
    }
    const patch: Partial<UpdateIngredientDto> = { stock: body.stock };
    if (body.low_stock_threshold !== undefined) {
      patch.low_stock_threshold = body.low_stock_threshold;
    }
    await row.update(patch);
    await row.reload();
    return { data: row, message: 'Ingredient stock has been updated.' };
  }
}
