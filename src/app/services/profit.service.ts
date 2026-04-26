// =========================================================================>> Core Library
import { Injectable } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Op } from 'sequelize';

// =========================================================================>> Custom Library
import OrderDetails      from '@app/models/order/detail.model';
import Order             from '@app/models/order/order.model';
import Menu         from '@app/models/menu/menu.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';

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
     * COGS = Σ (order_detail.qty × sum over product.recipes of (line.quantity × ingredient.unit_cost))
     */
    private async _cogs(startDate: Date, endDate: Date): Promise<number> {
        // Step 1 — fetch order details for the window
        const orders = await Order.findAll({
            attributes: ['id'],
            where     : { ordered_at: { [Op.between]: [startDate, endDate] } },
            include   : [
                {
                    model     : OrderDetails,
                    attributes: ['menu_id', 'qty'],
                },
            ],
        });

        // Flatten to a map menu_id → total qty ordered in the period
        const qtyByMenu = new Map<number, number>();
        for (const order of orders) {
            for (const detail of order.details ?? []) {
                const prev = qtyByMenu.get(detail.menu_id) ?? 0;
                qtyByMenu.set(detail.menu_id, prev + Number(detail.qty));
            }
        }

        if (qtyByMenu.size === 0) return 0;

        const menuIds = [...qtyByMenu.keys()];
        const menus   = await Menu.findAll({
            where     : { id: menuIds },
            attributes: ['id', 'recipes'],
        });

        const allIngredientIds = new Set<number>();
        for (const p of menus) {
            const lines: any[] = Array.isArray((p as any).recipes) ? (p as any).recipes : [];
            for (const line of lines) {
                const iid = Number(line?.ingredient_id);
                if (Number.isFinite(iid) && iid > 0) {
                    allIngredientIds.add(iid);
                }
            }
        }

        const ingredients = allIngredientIds.size
            ? await MenuIngredient.findAll({
                  where  : { id: [...allIngredientIds] },
                  attributes: ['id', 'unit_cost'],
              })
            : [];
        const unitCostById = new Map(ingredients.map((i) => [i.id, Number(i.unit_cost)]));

        const costPerUnit = new Map<number, number>();
        for (const p of menus) {
            const lines: any[] = Array.isArray((p as any).recipes) ? (p as any).recipes : [];
            let cpu = 0;
            for (const line of lines) {
                const iid = Number(line?.ingredient_id);
                const q   = Number(line?.quantity);
                if (!Number.isFinite(iid) || !Number.isFinite(q)) {
                    continue;
                }
                cpu += q * (unitCostById.get(iid) ?? 0);
            }
            costPerUnit.set(p.id, cpu);
        }

        let cogs = 0;
        for (const [menuId, totalQty] of qtyByMenu) {
            cogs += totalQty * (costPerUnit.get(menuId) ?? 0);
        }

        return cogs;
    }

    private _round(value: number, decimals = 2): number {
        return parseFloat(value.toFixed(decimals));
    }
}
