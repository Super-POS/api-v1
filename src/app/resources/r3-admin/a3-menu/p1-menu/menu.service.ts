// ===========================================================================>> Core Library
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// ============================================================================>> Third Party Library
import { col, literal, Op, OrderItem, UniqueConstraintError } from "sequelize";

// ===========================================================================>> Costom Library
import OrderDetails from "@app/models/order/detail.model";
import Order from "@app/models/order/order.model";
import User from "@app/models/user/user.model";
import { Col, Fn, Literal } from "sequelize/types/utils";
import Menu from "@app/models/menu/menu.model";
import MenuIngredient from "@app/models/menu/menu-ingredient.model";
import MenuSize from "@app/models/menu/menu-size.model";
import MenuType from "@app/models/menu/menu-type.model";
import { getMenuCatalogInclude } from "@app/utils/modifier-order.util";
import { FileService } from "src/app/services/file.service";
import { CreateMenuDto, MenuRecipeLineDto, UpdateMenuDto } from "./menu.dto";
export type Orders = Fn | Col | Literal | OrderItem[];

@Injectable()
export class MenuService {
  constructor(private readonly fileService: FileService) {}

  private _validateRecipeLines(lines: MenuRecipeLineDto[]) {
    const seen = new Set<number>();
    for (const line of lines) {
      if (seen.has(line.ingredient_id)) {
        throw new BadRequestException(
          `Duplicate ingredient_id ${line.ingredient_id} in recipes. Each ingredient may appear only once.`
        );
      }
      seen.add(line.ingredient_id);
    }
  }

  private async _assertIngredientsExist(
    lines: MenuRecipeLineDto[]
  ): Promise<void> {
    for (const line of lines) {
      const row = await MenuIngredient.findByPk(line.ingredient_id);
      if (!row) {
        throw new BadRequestException(
          `Ingredient id ${line.ingredient_id} does not exist.`
        );
      }
    }
  }

  private async _replaceSizes(
    menu_id: number,
    sizes: { size: string; price: number; recipes: MenuRecipeLineDto[] }[]
  ): Promise<void> {
    const allowed = new Set(['S', 'M', 'L']);
    const seen = new Set<string>();
    for (const s of sizes) {
      if (!allowed.has(s.size)) {
        throw new BadRequestException(`Invalid size "${s.size}". Must be S, M, or L.`);
      }
      if (seen.has(s.size)) {
        throw new BadRequestException(`Duplicate size "${s.size}" in sizes array.`);
      }
      seen.add(s.size);
      this._validateRecipeLines(s.recipes ?? []);
      await this._assertIngredientsExist(s.recipes ?? []);
    }
    if (seen.size === 0) {
      throw new BadRequestException('sizes must contain at least one entry.');
    }
    await MenuSize.destroy({ where: { menu_id } });
    await MenuSize.bulkCreate(
      sizes.map((s) => ({
        menu_id,
        size: s.size as any,
        price: s.price,
        recipes: s.recipes ?? [],
      }))
    );
  }

  /**
   * After bulk seed rows with explicit ids, PostgreSQL SERIAL may still point at 1.
   * Call before retrying Menu.create, or from seed.
   */
  private async _syncPostgresMenuIdSequence(): Promise<void> {
    const s = Menu.sequelize;
    if (!s || s.getDialect() !== "postgres") {
      return;
    }
    await s.query(
      `SELECT setval(
  pg_get_serial_sequence('menus', 'id'),
  COALESCE((SELECT MAX(id) FROM menus), 0),
  true
);`
    );
  }

  private _sizeInclude() {
    return { model: MenuSize, as: 'sizes', attributes: ['id', 'size', 'price', 'recipes'] };
  }

  // Method to retrieve the setup data for product types
  async getSetupData(): Promise<any> {
    try {
      const menuTypes = await MenuType.findAll({
        attributes: ["id", "name"],
      });

      const users = await User.findAll({
        attributes: ["id", "name"],
      });
      return {
        menuTypes,
        users,
      };
    } catch (error) {
      console.error("Error in setup method:", error);
      return {
        status: "error",
        message: "menus/setup",
      };
    }
  }

  async getData(params?: {
    page: number;
    limit: number;
    key?: string;
    type?: number;
    creator?: number;
    startDate?: string;
    endDate?: string;
    sort_by?: string;
    order?: string;
  }) {
    try {
      const offset = (params?.page - 1) * params?.limit;

      const toCambodiaDate = (dateString: string, isEndOfDay = false): Date => {
        const date = new Date(dateString);
        const utcOffset = 7 * 60;
        const localDate = new Date(date.getTime() + utcOffset * 60 * 1000);
        if (isEndOfDay) {
          localDate.setHours(23, 59, 59, 999);
        } else {
          localDate.setHours(0, 0, 0, 0);
        }
        return localDate;
      };

      const start = params?.startDate ? toCambodiaDate(params.startDate) : null;
      const end = params?.endDate ? toCambodiaDate(params.endDate, true) : null;

      const where: any = {};

      if (params?.key) {
        where[Op.or] = [
          { code: { [Op.iLike]: `%${params.key}%` } },
          { name: { [Op.iLike]: `%${params.key}%` } },
        ];
      }

      if (params?.type) {
        where.type_id = Number(params.type);
      }

      if (params?.creator) {
        where.creator_id = Number(params.creator);
      }

      if (start && end) {
        where.created_at = { [Op.between]: [start, end] };
      } else if (start) {
        where.created_at = { [Op.gte]: start };
      } else if (end) {
        where.created_at = { [Op.lte]: end };
      }

      const sortField = params?.sort_by || "name";
      const sortOrder = ["ASC", "DESC"].includes(
        (params?.order || "DESC").toUpperCase()
      )
        ? params?.order.toUpperCase()
        : "DESC";

      const sort: Orders = [];

      switch (sortField) {
        case "name":
          sort.push([col("name"), sortOrder]);
          break;
        case "unit_price":
          sort.push([col("unit_price"), sortOrder]);
          break;
        case "total_sale":
          sort.push([literal('"total_sale"'), sortOrder]);
          break;
        default:
          sort.push([sortField, sortOrder]);
          break;
      }

      const { rows, count } = await Menu.findAndCountAll({
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "has_sizes",
          "unit_price",
          "recipes",
          "is_available",
          "created_at",
          [
            literal(`(
                        SELECT SUM(qty)
                        FROM order_details AS od
                        WHERE od.menu_id = "Menu"."id"
                    )`),
            "total_sale",
          ],
          [
            literal(`(
                        SELECT SUM(od.unit_price * od.qty)
                        FROM order_details AS od
                        WHERE od.menu_id = "Menu"."id"
                    )`),
            "total_revenue",
          ],
        ],
        include: [
          { model: MenuType, attributes: ["id", "name"] },
          { model: OrderDetails, as: "orderDetails", attributes: [] },
          { model: User, attributes: ["id", "name", "avatar"] },
          this._sizeInclude(),
        ],
        where,
        distinct: true,
        offset,
        limit: params?.limit,
        order: sort,
      });

      const totalPages = Math.ceil(count / params?.limit);
      return {
        status: "success",
        data: rows,
        pagination: {
          page: params?.page,
          limit: params?.limit,
          totalPage: totalPages,
          total: count,
        },
      };
    } catch (error) {
      console.error("Error in getData:", error);
      return {
        status: "error",
        message: "menus/getData",
      };
    }
  }

  async view(menu_id: number) {
    const where: any = {
      menu_id: menu_id,
    };

    const data = await Order.findAll({
      attributes: [
        "id",
        "receipt_number",
        "total_price",
        "channel",
        "ordered_at",
      ],
      include: [
        {
          model: OrderDetails,
          where: where,
          attributes: ["id", "unit_price", "qty"],
          include: [
            {
              model: Menu,
              attributes: ["id", "name", "code", "image"],
              include: [{ model: MenuType, attributes: ["name"] }],
            },
          ],
        },
        { model: User, as: "cashier", attributes: ["id", "avatar", "name"] },
      ],
      order: [["ordered_at", "DESC"]],
      limit: 10,
    });
    return { data: data };
  }

  async create(
    body: CreateMenuDto,
    creator_id: number
  ): Promise<{ data: Menu; message: string }> {
    try {
      const checkExistCode = await Menu.findOne({ where: { code: body.code } });
      if (checkExistCode) {
        throw new BadRequestException("This code already exists in the system.");
      }

      const checkExistName = await Menu.findOne({ where: { name: body.name } });
      if (checkExistName) {
        throw new BadRequestException("This name already exists in the system.");
      }

      if (body.has_sizes) {
        if (!body.sizes?.length) {
          throw new BadRequestException("sizes is required when has_sizes is true.");
        }
      } else {
        const rawRecipes = body.recipes ?? [];
        this._validateRecipeLines(rawRecipes);
        await this._assertIngredientsExist(rawRecipes);
      }

      const { data: fileData } = await this.fileService.uploadBase64Image("menu", body.image);
      body.image = fileData.uri;

      const insert = () =>
        Menu.create({
          code: body.code,
          name: body.name,
          type_id: body.type_id,
          image: body.image,
          has_sizes: !!body.has_sizes,
          unit_price: body.has_sizes ? null : body.unit_price,
          recipes: body.has_sizes ? [] : (body.recipes ?? []),
          creator_id,
        });

      let menu: Menu;
      try {
        menu = await insert();
      } catch (e) {
        if (
          e instanceof UniqueConstraintError &&
          e.fields?.id != null &&
          Menu.sequelize?.getDialect() === "postgres"
        ) {
          await this._syncPostgresMenuIdSequence();
          menu = await insert();
        } else {
          throw e;
        }
      }

      if (body.has_sizes) {
        await this._replaceSizes(menu.id, body.sizes as any);
      }

      const data = await Menu.findByPk(menu.id, {
        attributes: [
          "id", "code", "name", "image", "has_sizes", "unit_price", "recipes", "created_at",
          [
            literal(`(SELECT COUNT(*) FROM order_details AS od WHERE od.menu_id = "Menu"."id" )`),
            "total_sale",
          ],
        ],
        include: [
          { model: MenuType, attributes: ["id", "name"] },
          { model: OrderDetails, as: "orderDetails", attributes: [] },
          { model: User, attributes: ["id", "name", "avatar"] },
          this._sizeInclude(),
          getMenuCatalogInclude(),
        ],
      });

      return {
        data: data,
        message: "Menu has been created.",
      };
    } catch (error) {
      console.error("Error in menu creation:", error);
      throw error;
    }
  }

  async update(
    body: UpdateMenuDto,
    id: number
  ): Promise<{ data: Menu; message: string }> {
    try {
      const checkExist = await Menu.findByPk(id);
      if (!checkExist) {
        throw new BadRequestException("No data found for the provided ID.");
      }

      const checkExistCode = await Menu.findOne({
        where: { id: { [Op.not]: id }, code: body.code },
      });
      if (checkExistCode) {
        throw new BadRequestException("This code already exists in the system.");
      }

      const checkExistName = await Menu.findOne({
        where: { id: { [Op.not]: id }, name: body.name },
      });
      if (checkExistName) {
        throw new BadRequestException("This name already exists in the system.");
      }

      if (body.image) {
        const { data: fileData } = await this.fileService.uploadBase64Image("menu", body.image);
        body.image = fileData.uri;
      } else {
        body.image = checkExist.image;
      }

      const hasSizes = body.has_sizes ?? checkExist.has_sizes;

      if (hasSizes) {
        if (body.sizes?.length) {
          await this._replaceSizes(id, body.sizes as any);
        }
      } else {
        if (body.recipes !== undefined) {
          this._validateRecipeLines(body.recipes);
          await this._assertIngredientsExist(body.recipes);
        }
      }

      const payload: any = {
        name: body.name,
        code: body.code,
        type_id: body.type_id,
        image: body.image,
        has_sizes: hasSizes,
      };

      if (!hasSizes) {
        payload.unit_price = body.unit_price ?? checkExist.unit_price;
        if (body.recipes !== undefined) {
          payload.recipes = body.recipes;
        }
      } else {
        payload.unit_price = null;
        payload.recipes = [];
      }

      const [rowsAffected] = await Menu.update(payload, { where: { id } });

      if (rowsAffected === 0) {
        throw new Error("No rows were affected by the update");
      }

      const data = await Menu.findByPk(id, {
        attributes: [
          "id", "code", "name", "image", "has_sizes", "unit_price", "recipes", "created_at",
          [
            literal(`(SELECT COUNT(*) FROM order_details AS od WHERE od.menu_id = "Menu"."id" )`),
            "total_sale",
          ],
        ],
        include: [
          { model: MenuType, attributes: ["id", "name"] },
          { model: OrderDetails, as: "orderDetails", attributes: [] },
          { model: User, attributes: ["id", "name", "avatar"] },
          this._sizeInclude(),
          getMenuCatalogInclude(),
        ],
      });

      if (!data) {
        throw new Error("Failed to retrieve updated product");
      }

      return {
        data: data,
        message: "Menu has been updated.",
      };
    } catch (error) {
      console.error("Error in product update:", error);
      throw error;
    }
  }

  // Method to delete a product by ID
  async toggleAvailability(id: number): Promise<{ data: { id: number; is_available: boolean }; message: string }> {
    const menu = await Menu.findByPk(id, { attributes: ['id', 'is_available'] });
    if (!menu) {
      throw new NotFoundException('Menu not found.');
    }
    menu.is_available = !menu.is_available;
    await menu.save();
    return {
      data   : { id: menu.id, is_available: menu.is_available },
      message: `Menu has been ${menu.is_available ? 'enabled' : 'disabled'}.`,
    };
  }

  async delete(id: number): Promise<{ message: string }> {
    try {
      const rowsAffected = await Menu.destroy({ where: { id } });
      if (rowsAffected === 0) {
        throw new NotFoundException("Menu not found.");
      }
      return { message: "This menu has been deleted successfully." };
    } catch (error) {
      throw new BadRequestException(
        error.message ?? "Something went wrong! Please try again later.",
        "Error Delete"
      );
    }
  }
}
