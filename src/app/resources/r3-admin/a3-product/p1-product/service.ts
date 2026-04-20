// ===========================================================================>> Core Library
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// ============================================================================>> Third Party Library
import { col, literal, Op, OrderItem } from "sequelize";

// ===========================================================================>> Costom Library
import OrderDetails from "@app/models/order/detail.model";
import Order from "@app/models/order/order.model";
import User from "@app/models/user/user.model";
import { Col, Fn, Literal } from "sequelize/types/utils";
import Product from "src/app/models/product/product.model";
import ProductType from "src/app/models/product/type.model";
import { FileService } from "src/app/services/file.service";
import { CreateProductDto, UpdateProductDto } from "./dto";
export type Orders = Fn | Col | Literal | OrderItem[];

@Injectable()
export class ProductService {
  constructor(private readonly fileService: FileService) {}

  // Method to retrieve the setup data for product types
  async getSetupData(): Promise<any> {
    // Fetch product types
    try {
      const productTypes = await ProductType.findAll({
        attributes: ["id", "name"],
      });

      // Fetch users
      const users = await User.findAll({
        attributes: ["id", "name"],
      });
      return {
        productTypes,
        users,
      };
    } catch (error) {
      console.error("Error in setup method:", error); // Log the error for debugging
      return {
        status: "error",
        message: "products/setup",
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
      const { rows, count } = await Product.findAndCountAll({
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "unit_price",
          "created_at",
          [
            literal(`(
                        SELECT SUM(qty)
                        FROM order_details AS od
                        WHERE od.product_id = "Product"."id"
                    )`),
            "total_sale",
          ],
        ],
        include: [
          {
            model: ProductType,
            attributes: ["id", "name"],
          },
          {
            model: OrderDetails,
            as: "pod",
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
        message: "products/getData",
      };
    }
  }

  async view(product_id: number) {
    const where: any = {
      product_id: product_id,
    };

    const data = await Order.findAll({
      attributes: [
        "id",
        "receipt_number",
        "total_price",
        "platform",
        "ordered_at",
      ],
      include: [
        {
          model: OrderDetails,
          where: where,
          attributes: ["id", "unit_price", "qty"],
          include: [
            {
              model: Product,
              attributes: ["id", "name", "code", "image"],
              include: [{ model: ProductType, attributes: ["name"] }],
            },
          ],
        },
        { model: User, attributes: ["id", "avatar", "name"] },
      ],
      order: [["ordered_at", "DESC"]],
      limit: 10,
    });
    return { data: data };
  }

  // Method to create a new product
  async create(
    body: CreateProductDto,
    creator_id: number
  ): Promise<{ data: Product; message: string }> {
    try {
      // Check if the product code already exists
      const checkExistCode = await Product.findOne({
        where: { code: body.code },
      });
      if (checkExistCode) {
        throw new BadRequestException(
          "This code already exists in the system."
        );
      }

      // Check if the product name already exists
      const checkExistName = await Product.findOne({
        where: { name: body.name },
      });
      if (checkExistName) {
        throw new BadRequestException(
          "This name already exists in the system."
        );
      }

      //   console.log("Before image upload");
      const result = await this.fileService.uploadBase64Image(
        "product",
        body.image
      );
      //   console.log("After image upload", result);

      if (result.message !== "File has been uploaded to file service") {
        throw new BadRequestException("Failed to upload image");
      }

      // Replace base64 string by file URI from FileService
      body.image = result.data.uri;

      //   console.log("Before product creation", body);
      const product = await Product.create({
        ...body,
        creator_id,
      });
      //   console.log("After product creation", product);

      const data = await Product.findByPk(product.id, {
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "unit_price",
          "created_at",
          [
            literal(
              `(SELECT COUNT(*) FROM order_details AS od WHERE od.product_id = "Product"."id" )`
            ),
            "total_sale",
          ],
        ],
        include: [
          {
            model: ProductType,
            attributes: ["id", "name"],
          },
          {
            model: OrderDetails,
            as: "pod",
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
        message: "Product has been created.",
      };
    } catch (error) {
      console.error("Error in product creation:", error);
      throw error;
    }
  }

  // Method to update an existing product
  async update(
    body: UpdateProductDto,
    id: number
  ): Promise<{ data: Product; message: string }> {
    try {
    //   console.log("Starting product update for ID:", id);
    //   console.log("Update data:", body);

      // Check if the product exists
      const checkExist = await Product.findByPk(id);
      if (!checkExist) {
        // console.log("Product not found for ID:", id);
        throw new BadRequestException("No data found for the provided ID.");
      }

      // Check for duplicate code
      const checkExistCode = await Product.findOne({
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
      const checkExistName = await Product.findOne({
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
        const result = await this.fileService.uploadBase64Image(
          "product",
          body.image
        );
        // console.log("Image upload result:", result);

        if (result.message !== "File has been uploaded to file service") {
          throw new BadRequestException("Failed to upload image");
        }
        body.image = result.data.uri;
      } else {
        // Keep existing image if not provided in update
        body.image = checkExist.image;
      }

      // Perform the update
    //   console.log("Executing update query");
      const [rowsAffected] = await Product.update(body, {
        where: { id: id },
      });

      if (rowsAffected === 0) {
        throw new Error("No rows were affected by the update");
      }

      // Retrieve updated product
    //   console.log("Fetching updated product");
      const data = await Product.findByPk(id, {
        attributes: [
          "id",
          "code",
          "name",
          "image",
          "unit_price",
          "created_at",
          [
            literal(
              `(SELECT COUNT(*) FROM order_details AS od WHERE od.product_id = "Product"."id" )`
            ),
            "total_sale",
          ],
        ],
        include: [
          {
            model: ProductType,
            attributes: ["id", "name"],
          },
          {
            model: OrderDetails,
            as: "pod",
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
        message: "Product has been updated.",
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
      const rowsAffected = await Product.destroy({
        where: {
          id: id,
        },
      });

      // Check if the product was found and deleted
      if (rowsAffected === 0) {
        throw new NotFoundException("Product not found.");
      }

      return { message: "This product has been deleted successfully." };
    } catch (error) {
      // Handle any errors during the delete operation
      throw new BadRequestException(
        error.message ?? "Something went wrong! Please try again later.",
        "Error Delete"
      );
    }
  }
}
