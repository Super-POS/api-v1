// ===========================================================================>> Core Library
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// ===========================================================================>> Third Party Library
import { literal, Op } from "sequelize";

// ===========================================================================>> Custom Library
import OrderDetails from "@app/models/order/detail.model";
import Order from "@app/models/order/order.model";
import Product from "@app/models/product/product.model";
import ProductType from "@app/models/product/type.model";
import Role from "@app/models/user/role.model";
import UserRoles from "@app/models/user/user_roles.model";
import User from "@app/models/user/user.model";
import { FileService } from "src/app/services/file.service";
import {
  CreateUserDto,
  UpdatePasswordDto,
  UpdateStatusDto,
  UpdateUserDto,
} from "./dto";
import { Create, List, Update } from "./interface";

@Injectable()
export class UserService {
  constructor(private readonly fileService: FileService) {}

  async setup(): Promise<{ roles: { id: number; name: string }[] }> {
    const roles = await Role.findAll({
      attributes: ["id", "name"],
    });
    return { roles: roles };
  }

  async getData(
    userId: number,
    page_size: number = 10,
    page: number = 1,
    key?: string,
    type_id?: number,
    startDate?: string,
    endDate?: string,
    sort?: "last_login" | "totalOrders" | "totalSales",
    order?: "ASC" | "DESC",
    role?: number
  ): Promise<List> {
    const offset = (page - 1) * page_size;

    // Helper function to convert date to Cambodia's timezone (UTC+7)
    const toCambodiaDate = (dateString: string, isEndOfDay = false): Date => {
      if (!dateString) return null;
      const date = new Date(dateString);
      const utcOffset = 7 * 60; // UTC+7 offset in minutes
      const localDate = new Date(date.getTime() + utcOffset * 60 * 1000);

      if (isEndOfDay) {
        localDate.setHours(23, 59, 59, 999);
      } else {
        localDate.setHours(0, 0, 0, 0);
      }
      return localDate;
    };

    // Calculate start and end dates for the filter
    const start = startDate ? toCambodiaDate(startDate) : null;
    const end = endDate ? toCambodiaDate(endDate, true) : null;

    // Base where conditions
    const where: any = {
      [Op.and]: [
        key
          ? {
              [Op.or]: [
                { name: { [Op.iLike]: `%${key}%` } },
                { phone: { [Op.like]: `%${key}%` } },
              ],
            }
          : {},
        { id: { [Op.not]: userId } },
        start && end ? { created_at: { [Op.between]: [start, end] } } : {},
      ],
    };

    // Determine order clause
    let orderClause: any[] = [["id", "DESC"]]; // Default order

    if (sort && order) {
      if (sort === "last_login") {
        orderClause = [[sort, order]];
      } else if (sort === "totalOrders" || sort === "totalSales") {
        orderClause = [[literal(`"${sort}"`), order]];
      }
    }

    // Build attributes array with proper typing
    const attributes: (string | [any, string])[] = [
      "id",
      "name",
      "avatar",
      "phone",
      "email",
      "is_active",
      "last_login",
      "created_at",
      [
        literal(`(
                SELECT COUNT(o.id)
                FROM "order" AS o
                WHERE o.cashier_id = "User".id
            )`),
        "totalOrders",
      ],
      [
        literal(`(
                SELECT COALESCE(SUM(o.total_price), 0)
                FROM "order" AS o
                WHERE o.cashier_id = "User".id
            )`),
        "totalSales",
      ],
    ];

    // Build include options
    const includeOptions = [
      {
        model: UserRoles,
        attributes: ["id", "role_id"],
        include: [
          {
            model: Role,
            attributes: ["id", "name"],
          },
        ],
        ...(role ? { where: { role_id: role }, required: true } : {}),
      },
    ];

    // Fetch data with the necessary associations and calculated fields
    const data = await User.findAll({
      attributes,
      include: includeOptions,
      where,
      order: orderClause,
      limit: page_size,
      offset,
      subQuery: false,
    });

    // Calculate total count without `include` for pagination
    const totalCount = await User.count({
      where,
      include: role
        ? [
            {
              model: UserRoles,
              where: { role_id: role },
              required: true,
            },
          ]
        : [],
    });

    const totalPages = Math.ceil(totalCount / page_size);

    const dataFormat: List = {
      data,
      pagination: {
        page: page,
        limit: page_size,
        totalPage: totalPages,
        total: totalCount,
      },
    };

    return dataFormat;
  }
  async view(userId: number) {
    const data = await User.findByPk(userId, {
      attributes: [
        "id",
        "name",
        "avatar",
        "phone",
        "email",
        "is_active",
        "last_login",
        "created_at",
        [
          literal(`
                        (
                            SELECT COUNT(o.id)
                            FROM "order" AS o
                            WHERE o.cashier_id = "User".id
                        )
                    `),
          "totalOrders",
        ],
        [
          literal(`
                        (
                            SELECT COALESCE(SUM(o.total_price), 0)
                            FROM "order" AS o
                            WHERE o.cashier_id = "User".id
                        )
                    `),
          "totalSales",
        ],
      ],
      include: [
        {
          model: UserRoles,
          attributes: ["id", "role_id"],
          include: [
            {
              model: Role,
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: Order,
          attributes: [],
        },
      ],
    });

    const where: any = {
      cashier_id: userId,
    };

    const sale = await Order.findAll({
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
      where: where,
      order: [["ordered_at", "DESC"]],
      limit: 10,
    });
    return { data: data, sale: sale };
  }

  async create(body: CreateUserDto, userId: number): Promise<Create> {
    try {
      // Check for existing user
      const user = await User.findOne({
        where: {
          [Op.or]: [{ phone: body.phone }, { email: body.email }],
        },
      });
      if (user) {
        console.warn(
          "⚠️ User with same email or phone already exists:",
          user.id
        );
        throw new BadRequestException("Email or phone already exists!");
      }

      // Validate and upload avatar
      if (body.avatar) {
        if (!this.isValidBase64(body.avatar)) {
          console.warn("⚠️ Invalid base64 image format");
          throw new BadRequestException("Invalid avatar image format");
        }
        const result = await this.fileService.uploadBase64Image(
          "user",
          body.avatar
        );
        if (result.error) {
          throw new BadRequestException(result.error);
        }
        body.avatar = result.data.uri;
      }

      // Create user
      const createdUser = await User.create({
        name: body.name,
        avatar: body.avatar,
        phone: body.phone,
        email: body.email,
        password: body.password,
        creator_id: userId,
      });

      // Assign roles
      if (body.role_ids && body.role_ids.length > 0) {
        const userRoles = body.role_ids.map((roleId, index) => ({
          user_id: createdUser.id,
          role_id: roleId,
          added_id: userId,
          created_at: new Date(),
          is_default: index === 0,
        }));
        await UserRoles.bulkCreate(userRoles);
      }

      // Fetch full user data
      const data = await User.findByPk(createdUser.id, {
        attributes: [
          "id",
          "name",
          "avatar",
          "phone",
          "email",
          "is_active",
          "created_at",
        ],
        include: [
          {
            model: UserRoles,
            attributes: ["id", "role_id", "is_default"],
            include: [
              {
                model: Role,
                attributes: ["id", "name"],
              },
            ],
          },
        ],
      });

      if (!data) {
        throw new BadRequestException("Failed to retrieve created user");
      }

      const dataFormat: Create = {
        data: data,
        message: "User has been created",
      };

      return dataFormat;
    } catch (error) {
      throw new BadRequestException(
        `Failed to create user: ${error.message}`,
        error.name || "Error"
      );
    }
  }

  private isValidBase64(str: string): boolean {
    const base64Pattern =
      /^data:image\/(jpeg|png|gif|bmp|webp);base64,[a-zA-Z0-9+/]+={0,2}$/;
    return base64Pattern.test(str);
  }

  async update(
    userId: number,
    body: UpdateUserDto,
    updaterId: number
  ): Promise<Update> {
    const transaction = await User.sequelize.transaction();
    try {
      // Find the current user
      const currentUser = await User.findByPk(userId, { transaction });
      if (!currentUser) {
        console.warn("⚠️ No user found with ID:", userId);
        throw new BadRequestException("Invalid user_id");
      }

      // Check if the phone is already in use
      const checkExistPhone = await User.findOne({
        where: { id: { [Op.not]: userId }, phone: body.phone },
        transaction,
      });
      if (checkExistPhone) {
        console.warn("⚠️ Phone already in use:", body.phone);
        throw new ConflictException("Phone is already in use");
      }

      // Check if the email is already in use
      const checkExistEmail = await User.findOne({
        where: { id: { [Op.not]: userId }, email: body.email },
        transaction,
      });
      if (checkExistEmail) {
        console.warn("⚠️ Email already in use:", body.email);
        throw new ConflictException("Email is already in use");
      }

      // Handle avatar update
      let avatarUri = currentUser.avatar; // Preserve existing avatar by default
      if (body.avatar !== undefined) {
        if (body.avatar && !body.avatar.startsWith("upload/file/")) {
          if (this.isValidBase64(body.avatar)) {
            const result = await this.fileService.uploadBase64Image(
              "user",
              body.avatar
            );
            if (result.error || !result.data || !result.data.uri) {
              console.error(
                "❌ Avatar upload failed:",
                result.error || "Invalid response"
              );
              throw new BadRequestException(
                result.error || "Invalid FileService response"
              );
            }
            avatarUri = result.data.uri;
          } else {
            console.warn("⚠️ Invalid base64 avatar format");
            throw new BadRequestException("Invalid image format");
          }
        } else if (body.avatar === "" || body.avatar === null) {
          avatarUri = null; 
        } else {
      
          avatarUri = body.avatar; 
        }
      } else {
      }

      await User.update(
        {
          name: body.name,
          avatar: avatarUri,
          phone: body.phone,
          email: body.email,
          updater_id: updaterId,
        },
        { where: { id: userId }, transaction }
      );
      const updatedUserCheck = await User.findByPk(userId, {
        attributes: ["avatar"],
        transaction,
      });

      // Update roles
      if (body.role_ids && body.role_ids.length > 0) {
        const existingRoles = await UserRoles.findAll({
          where: { user_id: userId },
          attributes: ["role_id"],
          transaction,
        });
        const existingRoleIds = existingRoles.map((role) => role.role_id);
        const newRoles = body.role_ids.filter(
          (roleId) => !existingRoleIds.includes(roleId)
        );
        if (newRoles.length > 0) {
          const newRoleAssignments = newRoles.map((roleId) => ({
            user_id: userId,
            role_id: roleId,
            added_id: updaterId,
            created_at: new Date(),
            is_default: false,
          }));
          await UserRoles.bulkCreate(newRoleAssignments, { transaction });
        } else {
        }
      } else {
      }

      // Fetch updated user
      const updateUser = await User.findByPk(userId, {
        attributes: [
          "id",
          "name",
          "avatar",
          "phone",
          "email",
          "is_active",
          "created_at",
        ],
        transaction,
      });


      await transaction.commit();
      const dataFormat: Update = {
        data: updateUser,
        message: "User has been updated successfully.",
      };
      return dataFormat;
    } catch (error) {
      await transaction.rollback();
      console.error("❌ [UserService] Error in update:", error);
      throw new BadRequestException(
        `Failed to update user: ${error.message}`,
        error.name || "Error"
      );
    }
  }

  async delete(userId: number): Promise<{ message: string }> {
    try {
      const rowsAffected = await User.destroy({
        where: {
          id: userId,
        },
      });

      if (rowsAffected === 0) {
        throw new NotFoundException("This user not found.");
      }

      return { message: "User has been deleted successfully." };
    } catch (error) {
      throw new BadRequestException(
        error.message ?? "Something went wrong!. Please try again later.",
        "Error Delete"
      );
    }
  }

  async updatePassword(
    userId: number,
    body: UpdatePasswordDto
  ): Promise<{ message: string }> {
    //=============================================
    let currentUser: User;
    try {
      currentUser = await User.findByPk(userId);
    } catch (error) {
      throw new BadRequestException(
        "Someting went wrong!. Please try again later.",
        "Error Query"
      );
    }
    if (!currentUser) {
      throw new BadRequestException("Invalid user_id");
    }

    //=============================================
    try {
      await User.update(
        {
          password: body.confirm_password,
        },
        {
          where: { id: userId },
        }
      );
    } catch (error) {
      throw new BadRequestException(
        "Someting went wrong!. Please try again later.",
        "Error Update"
      );
    }

    //=============================================
    return { message: "Password has been updated successfully." };
  }

  async updateStatus(
    userId: number,
    body: UpdateStatusDto
  ): Promise<{ message: string }> {
    //=============================================
    let currentUser: User;
    try {
      currentUser = await User.findByPk(userId);
    } catch (error) {
      throw new BadRequestException(
        "Something went wrong! Please try again later.",
        "Error Query"
      );
    }

    if (!currentUser) {
      throw new BadRequestException("Invalid user_id");
    }

    //=============================================
    // Convert is_active to `1` or `0` based on `true` or `false`
    const updatedStatus = body.is_active ? 1 : 0;

    // Prepare the body with the modified status
    const updateData = {
      is_active: updatedStatus,
    };

    try {
      await User.update(updateData, {
        where: { id: userId },
      });
    } catch (error) {
      throw new BadRequestException(
        "Something went wrong! Please try again later.",
        "Error Update"
      );
    }

    //=============================================
    return { message: "Status has been updated successfully." };
  }
}
