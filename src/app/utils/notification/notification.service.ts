// ================================================================>> Core Library
import Notifications from '@app/models/notification/notification.model';
import Order from '@app/models/order/order.model';
import User from '@app/models/user/user.model';
import { Injectable, NotFoundException } from '@nestjs/common';
// ================================================================>> Costom Library

/** API shape returned to the POS notification bell. */
export interface FormattedNotification {
    id: number;
    receipt_number: string;
    order_number: number | null;
    total_price: number;
    ordered_at: Date;
    cashier: { id: number; name: string; avatar: string } | null;
    read: boolean;
}

@Injectable()
export class NotificationService {

    /**
     * Map a Sequelize row to the client DTO. Returns null when the linked order
     * was removed (orphaned notification row) so callers can filter it out.
     * Cashier is optional — user may be null if the account was deleted.
     */
    private formatNotification(notification: Notifications): FormattedNotification | null {
        const order = notification.order;
        if (!order) {
            return null;
        }

        const user = notification.user;

        return {
            id: notification.id,
            receipt_number: order.receipt_number,
            order_number: order.order_number ?? null,
            total_price: order.total_price,
            ordered_at: order.ordered_at,
            cashier: user
                ? {
                    id: user.id,
                    name: user.name,
                    avatar: user.avatar,
                }
                : null,
            read: notification.read,
        };
    }

    async getData() {
        try {
            const notifications = await Promise.race([
                Notifications.findAll({
                    attributes: ['id', 'read'],
                    include: [
                        {
                            model: Order,
                            attributes: ['id', 'receipt_number', 'order_number', 'total_price', 'ordered_at'],
                            required: false,
                        },
                        {
                            model: User,
                            attributes: ['id', 'avatar', 'name'],
                            required: false,
                        },
                    ],
                    order: [['id', 'DESC']],
                }),
                this.createTimeoutPromise(4500),
            ]);

            const resolvedNotifications = notifications as Notifications[];
            const data = resolvedNotifications
                .map((notification) => this.formatNotification(notification))
                .filter((row): row is FormattedNotification => row !== null);

            return { data };
        } catch (err) {
            console.error('Error fetching notifications:', err);
            // Keep the app usable when DB/network is temporarily unavailable.
            // Returning an empty list prevents resolver/bootstrap failures.
            return { data: [] };
        }
    }

    private createTimeoutPromise(timeoutMs: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Notification query timeout after ${timeoutMs}ms`)), timeoutMs);
        });
    }

    async toggleReadStatus(id: number) {
        const notification = await Notifications.findByPk(id);

        if (!notification) {
            throw new NotFoundException(`Notification with ID ${id} not found`);
        }

        // Toggle the read status
        notification.read = !notification.read;
        await notification.save();

        // Fetch all notifications and format them
        const notifications = await Notifications.findAll({
            attributes: ['id', 'read'],
            include: [
                {
                    model: Order,
                    attributes: ['id', 'receipt_number', 'order_number', 'total_price', 'ordered_at'],
                    required: false,
                },
                {
                    model: User,
                    attributes: ['id', 'avatar', 'name'],
                    required: false,
                },
            ],
        });

        const data = notifications
            .map((notification) => this.formatNotification(notification))
            .filter((row): row is FormattedNotification => row !== null);

        return { data };
    }

    async deleteNotification(id: number) {
        const notification = await Notifications.findByPk(id);

        // If the notification does not exist, throw a NotFoundException
        if (!notification) {
            throw new NotFoundException(`Notification with ID ${id} not found`);
        }
        // Delete the notification
        await notification.destroy();
        return { message: "Nofification deleted successfully." };
    }

}
