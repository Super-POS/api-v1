// ===========================================================================>> Core Library
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

// ===========================================================================>> Third party Library
import { Op, Sequelize } from "sequelize";
// ===========================================================================>> Custom Library
import OrderDetails from "@app/models/order/detail.model";
import OrderDetailModifier from "@app/models/order/order-detail-modifier.model";
import Menu from "@app/models/menu/menu.model";
import MenuType from "@app/models/menu/menu-type.model";
import PaymentTransaction, { PaymentStatus } from "@app/models/payment/payment_transaction.model";
import User from "@app/models/user/user.model";
import Order from "src/app/models/order/order.model";
import { List } from "./interface";

@Injectable()
export class SaleService {
  async getUser() {
    const data = await User.findAll({
      attributes: ["id", "name"],
    });

    return { data: data };
  }

  async getData(
    userId: number,
    limit: number = 10, // Changed from page_size to limit
    page: number = 1,
    key?: string,
    platform?: string,
    startDate?: string,
    endDate?: string,
    sort?: "ordered_at" | "total_price",
    order?: "ASC" | "DESC"
  ) {
    try {
      const offset = (page - 1) * limit; // Updated to use limit

      // Helper function to convert date to Cambodia's timezone (UTC+7)
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

      // Calculate start and end dates for the filter
      const start = startDate ? toCambodiaDate(startDate) : null;
      const end = endDate ? toCambodiaDate(endDate, true) : null;

      // Build the dynamic `where` clause with filters
      const where: any = {
        cashier_id: userId,
        [Op.and]: [
          key
            ? Sequelize.where(
                Sequelize.literal(`CAST("receipt_number" AS TEXT)`),
                { [Op.like]: `%${key}%` }
              )
            : null,
          platform !== null && platform !== undefined ? { channel: platform } : null,
          start && end ? { ordered_at: { [Op.between]: [start, end] } } : null,
        ].filter(Boolean), // Remove null or undefined filters
      };

      // Set default sorting if not provided
      const defaultSort = "ordered_at";
      const defaultOrder = "DESC";

      // Validate sort field
      const validSortFields = ["ordered_at", "total_price"];
      const sortField = validSortFields.includes(sort) ? sort : defaultSort;

      // Validate order direction
      const validOrderDirections = ["ASC", "DESC"];
      const orderDirection = validOrderDirections.includes(order)
        ? order
        : defaultOrder;

      const data = await Order.findAll({
        attributes: [
          "id",
          "receipt_number",
          "total_price",
          "channel",
          "status",
          "ordered_at",
        ],
        include: [
          {
            model: OrderDetails,
            attributes: ["id", "unit_price", "qty", "line_note"],
            include: [
              {
                model: OrderDetailModifier,
                required: false,
                attributes: [
                  "id",
                  "modifier_option_id",
                  "group_name",
                  "option_label",
                  "price_delta_applied",
                ],
              },
              {
                model: Menu,
                attributes: ["id", "name", "code", "image"],
                include: [
                  {
                    model: MenuType,
                    attributes: ["name"],
                  },
                ],
              },
            ],
          },
          {
            model: User,
            as: "cashier",
            attributes: ["id", "avatar", "name"],
          },
        ],
        where: where,
        order: [[sortField, orderDirection]], // Use the validated sort parameters
        limit: limit, // Updated to use limit
        offset,
      });

      // Attach a cashier-facing payment status label for list rendering.
      // - cancelled: order cancelled by cashier/workflow
      // - paid: order has moved past awaiting_payment or has successful tx
      // - pending: still waiting payment / unresolved
      const orderIds = data.map((o) => o.id);
      const latestTxByOrder = new Map<number, PaymentTransaction>();
      if (orderIds.length > 0) {
        const txs = await PaymentTransaction.findAll({
          where: { order_id: { [Op.in]: orderIds } },
          order: [["id", "DESC"]],
        });
        for (const tx of txs) {
          if (!latestTxByOrder.has(tx.order_id)) {
            latestTxByOrder.set(tx.order_id, tx);
          }
        }
      }

      const dataWithPaymentStatus = data.map((row) => {
        const tx = latestTxByOrder.get(row.id);
        let payment_status: "paid" | "cancelled" | "pending" = "pending";

        if (row.status === "cancelled") {
          payment_status = "cancelled";
        } else if (tx?.status === PaymentStatus.SUCCESS) {
          payment_status = "paid";
        } else if (row.status !== "awaiting_payment") {
          // Cash / wallet and other settled paths generally move order out of awaiting_payment.
          payment_status = "paid";
        }

        return {
          ...row.toJSON(),
          payment_status,
        };
      });

      const totalCount = await Order.count({
        where: where,
      });

      const totalPages = Math.ceil(totalCount / limit); // Updated to use limit

      const dataFormat: List = {
        status: "success",
        data: dataWithPaymentStatus,
        pagination: {
          page: page,
          limit: limit, // Updated to use limit
          totalPage: totalPages,
          total: totalCount,
        },
      };

      return dataFormat;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async view(id: number) {
    try {
      const data = await Order.findByPk(id, {
        attributes: [
          "id",
          "receipt_number",
          "total_price",
          "channel",
          "status",
          "ordered_at",
        ],
        include: [
          {
            model: OrderDetails,
            attributes: ["id", "unit_price", "qty", "line_note"],
            include: [
              {
                model: OrderDetailModifier,
                required: false,
                attributes: [
                  "id",
                  "modifier_option_id",
                  "group_name",
                  "option_label",
                  "price_delta_applied",
                ],
              },
              {
                model: Menu,
                attributes: ["id", "name", "code", "image"],
                include: [
                  {
                    model: MenuType,
                    attributes: ["name"],
                  },
                ],
              },
            ],
          },
          {
            model: User,
            as: "cashier",
            attributes: ["id", "avatar", "name"],
          },
        ],
      });

      const dataFormat = {
        status: "success",
        data: data,
      };

      return dataFormat;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async delete(id: number): Promise<{ message: string }> {
    try {
      const rowsAffected = await Order.destroy({
        where: {
          id: id,
        },
      });

      if (rowsAffected === 0) {
        throw new NotFoundException("Sale record not found.");
      }

      return { message: "This order has been deleted successfully." };
    } catch (error) {
      throw new BadRequestException(
        error.message ?? "Something went wrong!. Please try again later.",
        "Error Delete"
      );
    }
  }
}
