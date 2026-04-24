// =========================================================================>> Core Library
import { BadRequestException, Injectable } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Sequelize, Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import { NotificationsGateway } from '@app/utils/notification-getway/notifications.gateway';
import Notifications from '@app/models/notification/notification.model';
import User from '@app/models/user/user.model';
import { TelegramService } from 'src/app/services/telegram.service';
import sequelizeConfig from 'src/config/sequelize.config';
import OrderDetails from 'src/app/models/order/detail.model';
import Order from 'src/app/models/order/order.model';
import Ingredient from 'src/app/models/product/ingredient.model';
import Product from 'src/app/models/product/product.model';
import RecipeItem from 'src/app/models/product/recipe_item.model';
import ProductType from 'src/app/models/product/type.model';
import { CreateOrderDto } from './dto';

// ======================================= >> Code Starts Here << ========================== //
@Injectable()
export class OrderService {

    constructor(private telegramService: TelegramService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { };

    async getProducts(): Promise<{ data: { id: number, name: string, products: Product[] }[] }> {
        // No nested `Product` → `ProductType` include: it re-joins the same `products_type` table and
        // breaks Sequelize/Postgres for this graph. `type.name` is filled from the parent row below.
        const data = await ProductType.findAll({
            attributes: ['id', 'name'],
            include: [
                {
                    model: Product,
                    as: 'products',
                    attributes: ['id', 'type_id', 'name', 'image', 'unit_price', 'code', 'stock'],
                    include: [
                        {
                            model: RecipeItem,
                            as: 'recipe_items',
                            attributes: ['id', 'ingredient_id', 'qty_required'],
                            required: false,
                            include: [
                                {
                                    model: Ingredient,
                                    as: 'ingredient',
                                    attributes: ['id', 'name', 'unit', 'stock'],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [['name', 'ASC']],
            subQuery: false,
        });

        const dataFormat: { id: number, name: string, products: Product[] }[] = data.map((type) => {
            const products = (type.products || []).map((product: Product) => {
                const availableStock = this.calculateAvailableStockByRecipe(product);
                const json = product.toJSON() as unknown as {
                    recipe_items?: object[];
                    type?: { name: string };
                    [key: string]: unknown;
                };
                if (Array.isArray(json.recipe_items)) {
                    json.recipe_items = json.recipe_items.map((ri) => ({
                        ...(ri as object),
                        scale_key: this.resolveScaleKey(ri as RecipeItem),
                    }));
                }
                json.type = { name: type.name as string };
                return {
                    ...json,
                    stock: availableStock,
                } as Product;
            });

            return {
                id: type.id,
                name: type.name,
                products,
            };
        });

        return { data: dataFormat };
    }

    // Method for creating an order
    async makeOrder(cashierId: number, body: CreateOrderDto): Promise<{ data: Order, message: string }> {
        // Initializing DB Connection
        const sequelize = new Sequelize(sequelizeConfig);
        let transaction: Transaction;

        try {
            // Open DB Connection
            transaction = await sequelize.transaction();

            // Create an order using method create()
            const order = await Order.create({
                cashier_id: cashierId,
                platform: body.platform,
                total_price: 0, // Initialize with 0, will update later
                receipt_number: await this._generateReceiptNumber(),
                ordered_at: null, // Will be updated later
            }, { transaction });

            // Find Total Price & Order Details
            let totalPrice = 0;
            let lines: { productId: number; qty: number; sugar_pct: number; shots: number }[] = [];
            try {
                lines = this.normalizeCartLines(JSON.parse(body.cart));
            } catch (e) {
                if (e instanceof BadRequestException) {
                    throw e;
                }
                throw new BadRequestException('Invalid cart format.');
            }
            if (lines.length === 0) {
                throw new BadRequestException('Cart is empty.');
            }
            const productIds = [...new Set(lines.map((l) => l.productId))];

            // Load menu rows + recipe (no row lock here: Postgres forbids FOR UPDATE on the nullable
            // side of an outer join, which Sequelize generates for optional `include`s).
            const products = await Product.findAll({
                where: { id: productIds },
                include: [
                    {
                        model: RecipeItem,
                        as: 'recipe_items',
                        attributes: ['id', 'ingredient_id', 'qty_required'],
                        required: false,
                        include: [
                            {
                                model: Ingredient,
                                as: 'ingredient',
                                attributes: ['id', 'name', 'unit', 'stock'],
                            },
                        ],
                    },
                ],
                transaction,
            });

            // Lock base stock rows in separate queries (valid FOR UPDATE in Postgres).
            const ingredientIdsToLock = new Set<number>();
            for (const product of products) {
                for (const ri of product.recipe_items || []) {
                    if (ri.ingredient_id) {
                        ingredientIdsToLock.add(ri.ingredient_id);
                    }
                }
            }
            const lockedIngredients = ingredientIdsToLock.size > 0
                ? await Ingredient.findAll({
                    where: { id: [...ingredientIdsToLock] },
                    transaction,
                    lock: true,
                })
                : [];
            const stockByIngredientId = new Map<number, number>(
                lockedIngredients.map((ing) => [ing.id, Number(ing.stock) || 0])
            );

            const productIdsNoRecipe: number[] = [];
            for (const product of products) {
                if (!product.recipe_items || product.recipe_items.length === 0) {
                    productIdsNoRecipe.push(product.id);
                }
            }
            if (productIdsNoRecipe.length > 0) {
                const lockedNoRecipe = await Product.findAll({
                    where: { id: productIdsNoRecipe },
                    transaction,
                    lock: true,
                });
                for (const locked of lockedNoRecipe) {
                    const existing = products.find((p) => p.id === locked.id);
                    if (existing) {
                        existing.stock = locked.stock;
                    }
                }
            }

            const productMap = new Map<number, Product>(
                products.map((product) => [product.id, product])
            );

            for (const line of lines) {
                if (!productMap.has(line.productId)) {
                    throw new BadRequestException(`Unknown product in cart (id ${line.productId}).`);
                }
            }

            // Validate quantities + aggregate ingredient demand across the whole cart (multi-item orders).
            const requiredByIngredientId = new Map<number, number>();
            const ingredientMeta = new Map<number, { name: string; unit: string }>();

            for (const line of lines) {
                const product = productMap.get(line.productId)!;
                const qtyNum = line.qty;
                const recipeItems = product.recipe_items || [];

                if (recipeItems.length > 0) {
                    for (const recipeItem of recipeItems) {
                        const ingId = recipeItem.ingredient_id;
                        if (!ingId) {
                            continue;
                        }
                        const lineNeed = this.effectiveLineIngredientQty(
                            recipeItem,
                            qtyNum,
                            line.sugar_pct,
                            line.shots,
                        );
                        requiredByIngredientId.set(ingId, (requiredByIngredientId.get(ingId) ?? 0) + lineNeed);
                        const ing = recipeItem.ingredient;
                        if (ing) {
                            ingredientMeta.set(ingId, { name: ing.name, unit: ing.unit });
                        }
                    }
                } else if (product.stock < qtyNum) {
                    throw new BadRequestException(
                        `Menu item "${product.name}" is out of stock (available: ${product.stock}, requested: ${qtyNum}).`
                    );
                }
            }

            for (const [ingId, need] of requiredByIngredientId) {
                const onHand = stockByIngredientId.get(ingId) ?? 0;
                if (onHand < need) {
                    const m = ingredientMeta.get(ingId);
                    const label = m ? `${m.name}` : 'Ingredient';
                    const unit = m?.unit ?? 'unit';
                    throw new BadRequestException(
                        `Not enough ${label} for this order (available: ${onHand} ${unit}, required: ${need} ${unit}).`
                    );
                }
            }

            // Persist order details and decrement ingredient stock.
            for (const line of lines) {
                const product = productMap.get(line.productId)!;
                const qtyNum = line.qty;
                await OrderDetails.create({
                    order_id: order.id,
                    product_id: product.id,
                    qty: qtyNum,
                    unit_price: product.unit_price,
                }, { transaction });

                const recipeItems = product.recipe_items || [];
                if (recipeItems.length > 0) {
                    for (const recipeItem of recipeItems) {
                        const requiredQty = this.effectiveLineIngredientQty(
                            recipeItem,
                            qtyNum,
                            line.sugar_pct,
                            line.shots,
                        );
                        if (requiredQty <= 0) {
                            continue;
                        }
                        await Ingredient.decrement('stock', {
                            by: requiredQty,
                            where: { id: recipeItem.ingredient_id },
                            transaction,
                        });
                    }
                } else {
                    // Fallback for products without recipes
                    await Product.decrement('stock', {
                        by: qtyNum,
                        where: { id: product.id },
                        transaction,
                    });
                }

                totalPrice += qtyNum * product.unit_price;
            }

            // Update Order with total price and ordered_at timestamp
            await Order.update({
                total_price: totalPrice,
                ordered_at: new Date(),
            }, {
                where: { id: order.id },
                transaction,
            });

            // Create notification for this order
            await Notifications.create({
                order_id: order.id,
                user_id: cashierId,
                read: false,
            }, { transaction });

            // Get order details for client response
            const data: Order = await Order.findByPk(order.id, {
                attributes: ['id', 'receipt_number', 'total_price', 'platform', 'ordered_at'],
                include: [
                    {
                        model: OrderDetails,
                        as: 'details',
                        attributes: ['id', 'unit_price', 'qty'],
                        include: [
                            {
                                model: Product,
                                as: 'product',
                                attributes: ['id', 'name', 'code', 'image'],
                                include: [
                                    {
                                        model: ProductType,
                                        as: 'type',
                                        attributes: ['name'],
                                    }
                                ]
                            },
                        ],
                    },
                    {
                        model: User,
                        as: 'cashier',
                        attributes: ['id', 'avatar', 'name'],
                    },
                ],
                transaction, // Ensure this is inside the same transaction
            });

            // Commit transaction after successful operations
            await transaction.commit();
            const currentDateTime = await this.getCurrentDateTimeInCambodia();
            let htmlMessage = `<b>ការបញ្ជាទិញទទួលបានជោគជ័យ!</b>\n`;
            htmlMessage += `-លេខវិកយប័ត្រ`;
            htmlMessage += `\u2003៖ ${data.receipt_number}\n`;
            htmlMessage += `-តម្លៃសរុប​​​​`;
            htmlMessage += `\u2003\u2003\u2003៖ ${this.formatPrice(data.total_price)} ៛\n`;
            htmlMessage += `-អ្នកគិតលុយ`;
            htmlMessage += `\u2003\u2003 ៖ ${data.cashier?.name || ''}\n`;
            htmlMessage += `-តាមរយះ`;
            htmlMessage += `\u2003\u2003\u2003 ៖ ${body.platform || ''}\n`;
            htmlMessage += `-កាលបរិច្ឆេទ\u2003\u2003៖ ${currentDateTime}\n`;

            // Send
            await this.telegramService.sendHTMLMessage(htmlMessage);

            const notifications = await Notifications.findAll({
                attributes: ['id', 'read'],
                include: [
                    {
                        model: Order,
                        attributes: ['id', 'receipt_number', 'total_price', 'ordered_at'],
                    },
                    {
                        model: User,
                        attributes: ['id', 'avatar', 'name'],
                    },

                ],
                order: [['id', 'DESC']],
            });
            const dataNotifications = notifications.map(notification => ({
                id: notification.id,
                receipt_number: notification.order.receipt_number,
                total_price: notification.order.total_price,
                ordered_at: notification.order.ordered_at,
                cashier: {
                    id: notification.user.id,
                    name: notification.user.name,
                    avatar: notification.user.avatar
                },
                read: notification.read
            }));
            this.notificationsGateway.sendOrderNotification({ data: dataNotifications });
            return { data, message: 'ការបញ្ជាទិញត្រូវបានបង្កើតដោយជោគជ័យ។' };

        } catch (error) {
            if (transaction) {
                await transaction.rollback(); // Rollback transaction on error
            }
            // Preserve explicit client-facing errors (e.g. out of stock) instead of masking them
            if (error instanceof BadRequestException) {
                throw error;
            }
            console.error('Error during order creation:', error);
            throw new BadRequestException('Something went wrong! Please try again later.', 'Error during order creation.');
        } finally {
            // Close DB connection if necessary
            await sequelize.close(); // Close sequelize connection
        }
    }

    /**
     * Worst-case servings: 100% sugar and double shot so the listed "available" count is never optimistic.
     */
    private calculateAvailableStockByRecipe(product: Product): number {
        const recipeItems = product.recipe_items || [];
        if (recipeItems.length === 0) {
            return Number(product.stock || 0);
        }

        const sugarPctMax = 100;
        const shotsMax = 2;

        let available = Number.MAX_SAFE_INTEGER;
        for (const recipeItem of recipeItems) {
            const ingredient = recipeItem.ingredient;
            const perCup = Number(recipeItem.qty_required || 0);

            if (!ingredient || perCup <= 0) {
                continue;
            }

            const perCupWorst = this.worstCasePerCup(
                perCup,
                this.resolveScaleKey(recipeItem),
                sugarPctMax,
                shotsMax,
            );
            const cups = Math.floor(Number(ingredient.stock || 0) / perCupWorst);
            available = Math.min(available, cups);
        }

        return available === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, available);
    }

    private worstCasePerCup(
        perCup: number,
        scaleKey: 'none' | 'sugar' | 'shot',
        sugarPct: number,
        shots: number,
    ): number {
        const key = scaleKey;
        if (key === 'sugar') {
            return perCup * (Math.min(100, Math.max(0, sugarPct)) / 100);
        }
        if (key === 'shot') {
            return perCup * (shots >= 2 ? 2 : 1);
        }
        return perCup;
    }

    /**
     * Derive sugar/shot scaling without DB `scale_key` column: matches ingredient name.
     * (After migration, prefer optional column if present.)
     */
    private resolveScaleKey(ri: RecipeItem & { ingredient?: { name?: string } }): 'none' | 'sugar' | 'shot' {
        const n = (ri.ingredient?.name || '').toLowerCase().trim();
        if (n === 'sugar') {
            return 'sugar';
        }
        if (n === 'coffee beans') {
            return 'shot';
        }
        return 'none';
    }

    private effectiveLineIngredientQty(
        recipeItem: RecipeItem,
        lineQty: number,
        sugarPct: number,
        shots: number,
    ): number {
        const perUnit = Number(recipeItem.qty_required || 0);
        const perLineScaled = this.worstCasePerCup(
            perUnit,
            this.resolveScaleKey(recipeItem),
            sugarPct,
            shots,
        );
        return perLineScaled * lineQty;
    }

    /**
     * Supports legacy cart: `{"productId": qty}` and new format: `{ "lines": [{ "product_id", "qty", "sugar_pct", "shots" }] }`.
     */
    private normalizeCartLines(raw: unknown): { productId: number; qty: number; sugar_pct: number; shots: number }[] {
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { lines?: unknown }).lines)) {
            const out: { productId: number; qty: number; sugar_pct: number; shots: number }[] = [];
            for (const line of (raw as { lines: Record<string, unknown>[] }).lines) {
                const productId = Number(line?.product_id);
                const qty = Number(line?.qty);
                if (!Number.isInteger(productId) || productId <= 0) {
                    throw new BadRequestException('Invalid product in cart line.');
                }
                if (!Number.isFinite(qty) || qty <= 0) {
                    throw new BadRequestException(`Invalid quantity for product "${productId}".`);
                }
                out.push({
                    productId,
                    qty: Math.min(1000, Math.floor(qty)),
                    sugar_pct: this.clampSugarPct(line?.sugar_pct),
                    shots: this.normalizeShots(line?.shots),
                });
            }
            return out;
        }

        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            const out: { productId: number; qty: number; sugar_pct: number; shots: number }[] = [];
            for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
                if (k === 'lines') {
                    continue;
                }
                const productId = Number(k);
                const qty = Number(v);
                if (!Number.isInteger(productId) || productId <= 0) {
                    continue;
                }
                if (!Number.isFinite(qty) || qty <= 0) {
                    throw new BadRequestException(`Invalid quantity for product "${productId}".`);
                }
                out.push({
                    productId,
                    qty: Math.min(1000, Math.floor(qty)),
                    sugar_pct: 100,
                    shots: 1,
                });
            }
            return out;
        }

        return [];
    }

    private clampSugarPct(v: unknown): number {
        const n = Number(v);
        if (!Number.isFinite(n)) {
            return 100;
        }
        return Math.min(100, Math.max(0, Math.round(n)));
    }

    private normalizeShots(v: unknown): number {
        const n = Number(v);
        return n >= 2 ? 2 : 1;
    }

    private formatPrice(price: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    }

    private async getCurrentDateTimeInCambodia(): Promise<string> {
        const now = new Date();

        // Options for Cambodia time zone with 12-hour format
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Phnom_Penh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true, // Use 12-hour format with AM/PM
        };

        const formatter = new Intl.DateTimeFormat('en-GB', options);
        const parts = formatter.formatToParts(now);

        // Extract date and time components
        const day = parts.find(p => p.type === 'day')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const year = parts.find(p => p.type === 'year')?.value;
        const hour = parts.find(p => p.type === 'hour')?.value;
        const minute = parts.find(p => p.type === 'minute')?.value;
        const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value; // AM/PM

        // Short date format: dd/mm/yyyy hh:mm AM/PM
        return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
    }

    // Private method to generate a unique receipt number
    private async _generateReceiptNumber(): Promise<string> {

        const number = Math.floor(Math.random() * 9000000) + 1000000;

        return await Order.findOne({
            where: {
                receipt_number: number+'',
            },
        }).then((order) => {

            if (order) {
                return this._generateReceiptNumber() + '';
            }

            return number + '';
        });
    }
}
