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
import MenuType from "@app/models/menu/menu-type.model";
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

  // Method to retrieve the setup data for product types
  async getSetupData(): Promise<any> {
    // Fetch product types
    try {
      const menuTypes = await MenuType.findAll({
        attributes: ["id", "name"],
      });

      // Fetch users
      const users = await User.findAll({
        attributes: ["id", "name"],
      });
      return {
        menuTypes,
        users,
      };
    } catch (error) {
      console.error("Error in setup method:", error); // Log the error for debugging
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
      // Calculate offset for pagination
      const offset = (params?.page - 1) * params?.limit;

      // Helper to convert to UTC+7 (Cambodia time)
      const toCambodiaDate = (dateString: string, isEndOfDay = false): Date => {
        const date = new Date(dateString);
        const utcOffset = 7 * 60; // UTC+7 offset in minutes
        const localDate = new Date(date.getTime() + utcOffset * 60 * 1000);

        if (isEndOfDay) {
          localDate.setHours(23, 59, 59, 999); // End of day
        } else {
          localDate.setHours(0, 0, 0, 0); // Start of day
        }

        return localDate;
      };

      // Prepare date range
      const start = params?.startDate ? toCambodiaDate(params.startDate) : null;
      const end = params?.endDate ? toCambodiaDate(params.endDate, true) : null;

      // Construct WHERE clause
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

      // Smart date range logic
      if (start && end) {
        where.created_at = { [Op.between]: [start, end] };
      } else if (start) {
        where.created_at = { [Op.gte]: start };
      } else if (end) {
        where.created_at = { [Op.lte]: end };
      }

      // Sorting
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

      // Run query
      const { rows, count } = await Menu.findAndCountAll({
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "unit_price",
          "recipes",
          "created_at",
          [
            literal(`(
                        SELECT SUM(qty)
                        FROM order_details AS od
                        WHERE od.menu_id = "Menu"."id"
                    )`),
            "total_sale",
          ],
        ],
        include: [
          {
            model: MenuType,
            attributes: ["id", "name"],
          },
          {
            model: OrderDetails,
            as: "orderDetails",
            attributes: [],
          },
          {
            model: User,
            attributes: ["id", "name", "avatar"],
          },
        ],
        where,
        distinct: true,
        offset,
        limit: params?.limit,
        order: sort,
      });

      // Pagination info
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

  // Method to create a new menu
  async create(
    body: CreateMenuDto,
    creator_id: number
  ): Promise<{ data: Menu; message: string }> {
    try {
      // Check if the menu code already exists
      const checkExistCode = await Menu.findOne({
        where: { code: body.code },
      });
      if (checkExistCode) {
        throw new BadRequestException(
          "This code already exists in the system."
        );
      }

      // Check if the menu name already exists
      const checkExistName = await Menu.findOne({
        where: { name: body.name },
      });
      if (checkExistName) {
        throw new BadRequestException(
          "This name already exists in the system."
        );
      }

      const rawRecipes = body.recipes ?? [];
      this._validateRecipeLines(rawRecipes);
      await this._assertIngredientsExist(rawRecipes);

      //   console.log("Before image upload");
      const { data: fileData } = await this.fileService.uploadBase64Image("menu", body.image);
      body.image = fileData.uri;

      //   console.log("Before menu creation", body);
      const { recipes, ...rest } = body;
      const { id: _clientId, ...row } = rest as CreateMenuDto & { id?: number };
      void _clientId;
      const insert = () =>
        Menu.create({
          ...row,
          recipes: rawRecipes,
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
      //   console.log("After menu creation", menu);

      const data = await Menu.findByPk(menu.id, {
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "unit_price",
          "recipes",
          "created_at",
          [
            literal(
              `(SELECT COUNT(*) FROM order_details AS od WHERE od.menu_id = "Menu"."id" )`
            ),
            "total_sale",
          ],
        ],
        include: [
          {
            model: MenuType,
            attributes: ["id", "name"],
          },
          {
            model: OrderDetails,
            as: "orderDetails",
            attributes: [],
          },
          {
            model: User,
            attributes: ["id", "name", "avatar"],
          },
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

  // Method to update an existing product
  async update(
    body: UpdateMenuDto,
    id: number
  ): Promise<{ data: Menu; message: string }> {
    try {
    //   console.log("Starting product update for ID:", id);
    //   console.log("Update data:", body);

      // Check if the product exists
      const checkExist = await Menu.findByPk(id);
      if (!checkExist) {
        // console.log("Menu not found for ID:", id);
        throw new BadRequestException("No data found for the provided ID.");
      }

      // Check for duplicate code
      const checkExistCode = await Menu.findOne({
        where: {
          id: { [Op.not]: id },
          code: body.code,
        },
      });
      if (checkExistCode) {
        // console.log("Duplicate code found:", body.code);
        throw new BadRequestException(
          "This code already exists in the system."
        );
      }

      // Check for duplicate name
      const checkExistName = await Menu.findOne({
        where: {
          id: { [Op.not]: id },
          name: body.name,
        },
      });
      if (checkExistName) {
        // console.log("Duplicate name found:", body.name);
        throw new BadRequestException(
          "This name already exists in the system."
        );
      }

      // Handle image update if provided
      if (body.image) {
        // console.log("Processing image update");
        const { data: fileData } = await this.fileService.uploadBase64Image("menu", body.image);
        body.image = fileData.uri;
      } else {
        // Keep existing image if not provided in update
        body.image = checkExist.image;
      }

      if (body.recipes !== undefined) {
        this._validateRecipeLines(body.recipes);
        await this._assertIngredientsExist(body.recipes);
      }

      // Perform the update
    //   console.log("Executing update query");
      const { recipes: nextRecipes, ...updateFields } = body;
      const payload: Parameters<typeof Menu.update>[0] = { ...updateFields };
      if (nextRecipes !== undefined) {
        payload.recipes = nextRecipes;
      }
      const [rowsAffected] = await Menu.update(payload, {
        where: { id: id },
      });

      if (rowsAffected === 0) {
        throw new Error("No rows were affected by the update");
      }

      // Retrieve updated product
    //   console.log("Fetching updated product");
      const data = await Menu.findByPk(id, {
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "unit_price",
          "recipes",
          "created_at",
          [
            literal(
              `(SELECT COUNT(*) FROM order_details AS od WHERE od.menu_id = "Menu"."id" )`
            ),
            "total_sale",
          ],
        ],
        include: [
          {
            model: MenuType,
            attributes: ["id", "name"],
          },
          {
            model: OrderDetails,
            as: "orderDetails",
            attributes: [],
          },
          {
            model: User,
            attributes: ["id", "name", "avatar"],
          },
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
  async delete(id: number): Promise<{ message: string }> {
    try {
      // Attempt to delete the product
      const rowsAffected = await Menu.destroy({
        where: {
          id: id,
        },
      });

      // Check if the product was found and deleted
      if (rowsAffected === 0) {
        throw new NotFoundException("Menu not found.");
      }

      return { message: "This menu has been deleted successfully." };
    } catch (error) {
      // Handle any errors during the delete operation
      throw new BadRequestException(
        error.message ?? "Something went wrong! Please try again later.",
        "Error Delete"
      );
    }
  }
}
