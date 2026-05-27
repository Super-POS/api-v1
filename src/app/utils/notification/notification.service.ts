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

/** How long (ms) the GET response is cached before the next DB query is allowed. */
const CACHE_TTL_MS = 5_000;

@Injectable()
export class NotificationService {

    private _cache: { data: FormattedNotification[]; expiresAt: number } | null = null;

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
        const now = Date.now();
        if (this._cache && now < this._cache.expiresAt) {
            return { data: this._cache.data };
        }

        try {
            const notifications = await this._fetchWithTimeout(4500);
            const data = notifications
                .map((n) => this.formatNotification(n))
                .filter((row): row is FormattedNotification => row !== null);

            this._cache = { data, expiresAt: now + CACHE_TTL_MS };
            return { data };
        } catch (err) {
            console.error('Error fetching notifications:', err);
            // Keep the app usable when DB/network is temporarily unavailable.
            return { data: [] };
        }
    }

    /**
     * Runs the DB query with a hard timeout. The timer is always cleared in the
     * `finally` block so it does not leak when the query resolves first.
     */
    private async _fetchWithTimeout(timeoutMs: number): Promise<Notifications[]> {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`Notification query timeout after ${timeoutMs}ms`)),
                timeoutMs,
            );
        });

        try {
            return await Promise.race([
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
                timeoutPromise,
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    async toggleReadStatus(id: number) {
        const notification = await Notifications.findByPk(id);

        if (!notification) {
            throw new NotFoundException(`Notification with ID ${id} not found`);
        }

        notification.read = !notification.read;
        await notification.save();

        this._cache = null;

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
            .map((n) => this.formatNotification(n))
            .filter((row): row is FormattedNotification => row !== null);

        this._cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return { data };
    }

    async deleteNotification(id: number) {
        const notification = await Notifications.findByPk(id);

        if (!notification) {
            throw new NotFoundException(`Notification with ID ${id} not found`);
        }

        await notification.destroy();
        this._cache = null;
        return { message: "Nofification deleted successfully." };
    }

}
