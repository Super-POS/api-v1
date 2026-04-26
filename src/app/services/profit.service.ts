// =========================================================================>> Core Library
import { Injectable } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Op } from 'sequelize';

// =========================================================================>> Custom Library
import OrderDetails      from '@app/models/order/detail.model';
import Order             from '@app/models/order/order.model';
import ProductIngredient from '@app/models/product/ingredient.model';
import ProductRecipe     from '@app/models/product/recipe.model';

export interface ProfitMetrics {
    revenue         : number;
    cogs            : number;
    gross_profit    : number;
    net_profit      : number;
    gross_margin_pct: number;
    net_margin_pct  : number;
}

@Injectable()
export class ProfitService {

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Calculate revenue, COGS, and profit for a given date window.
     * Only orders that have an `ordered_at` timestamp inside [startDate, endDate]
     * are included (regardless of status), matching the convention used by the
     * rest of the dashboard.
     */
    async calculate(startDate: Date, endDate: Date): Promise<ProfitMetrics> {
        const [revenue, cogs] = await Promise.all([
            this._revenue(startDate, endDate),
            this._cogs(startDate, endDate),
        ]);

        const gross_profit     = revenue - cogs;
        const net_profit       = gross_profit; // operating costs not yet tracked
        const gross_margin_pct = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
        const net_margin_pct   = revenue > 0 ? (net_profit   / revenue) * 100 : 0;

        return {
            revenue         : this._round(revenue),
            cogs            : this._round(cogs),
            gross_profit    : this._round(gross_profit),
            net_profit      : this._round(net_profit),
            gross_margin_pct: this._round(gross_margin_pct),
            net_margin_pct  : this._round(net_margin_pct),
        };
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /** Total revenue = sum of order.total_price for the period */
    private async _revenue(startDate: Date, endDate: Date): Promise<number> {
        const total = await Order.sum('total_price', {
            where: { ordered_at: { [Op.between]: [startDate, endDate] } },
        });
        return total ?? 0;
    }

    /**
     * COGS = Σ (order_detail.qty × product_recipe.quantity × ingredient.unit_cost)
     *
     * Strategy:
     *  1. Load order details for the period.
     *  2. Load recipes + ingredient unit costs for all unique products.
     *  3. Multiply out.
     */
    private async _cogs(startDate: Date, endDate: Date): Promise<number> {
        // Step 1 — fetch order details for the window
        const orders = await Order.findAll({
            attributes: ['id'],
            where     : { ordered_at: { [Op.between]: [startDate, endDate] } },
            include   : [
                {
                    model     : OrderDetails,
                    attributes: ['product_id', 'qty'],
                },
            ],
        });

        // Flatten to a map product_id → total qty ordered in the period
        const qtyByProduct = new Map<number, number>();
        for (const order of orders) {
            for (const detail of order.details ?? []) {
                const prev = qtyByProduct.get(detail.product_id) ?? 0;
                qtyByProduct.set(detail.product_id, prev + Number(detail.qty));
            }
        }

        if (qtyByProduct.size === 0) return 0;

        // Step 2 — load recipes with ingredient unit costs
        const productIds = [...qtyByProduct.keys()];
        const recipes    = await ProductRecipe.findAll({
            where  : { product_id: productIds },
            include: [
                {
                    model     : ProductIngredient,
                    attributes: ['id', 'unit_cost'],
                },
            ],
        });

        // Step 3 — compute cost per product unit, then multiply by qty
        // cost_per_unit[product_id] = Σ (recipe.quantity × ingredient.unit_cost)
        const costPerUnit = new Map<number, number>();
        for (const recipe of recipes) {
            const ingredientCost = Number(recipe.quantity) * Number(recipe.ingredient?.unit_cost ?? 0);
            const prev           = costPerUnit.get(recipe.product_id) ?? 0;
            costPerUnit.set(recipe.product_id, prev + ingredientCost);
        }

        let cogs = 0;
        for (const [productId, totalQty] of qtyByProduct) {
            cogs += totalQty * (costPerUnit.get(productId) ?? 0);
        }

        return cogs;
    }

    private _round(value: number, decimals = 2): number {
        return parseFloat(value.toFixed(decimals));
    }
}
