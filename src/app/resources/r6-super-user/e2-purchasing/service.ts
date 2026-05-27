import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import ErpSupplier from '@app/models/erp/supplier.model';
import ErpPurchaseOrder, { PurchaseOrderStatus } from '@app/models/erp/purchase-order.model';
import ErpPurchaseOrderItem from '@app/models/erp/purchase-order-item.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import {
    CreatePurchaseOrderDto, CreateSupplierDto,
    ReceiveGoodsDto, UpdatePOStatusDto, UpdateSupplierDto,
} from './dto';

@Injectable()
export class PurchasingService {

    // ─── Suppliers ────────────────────────────────────────────────────────────

    async getSuppliers(active_only = false) {
        const where: any = {};
        if (active_only) where.is_active = true;
        return ErpSupplier.findAll({ where, order: [['name', 'ASC']] });
    }

    async getSupplier(id: number) {
        const s = await ErpSupplier.findByPk(id, {
            include: [{
                model  : ErpPurchaseOrder,
                limit  : 10,
                order  : [['created_at', 'DESC']],
            }],
        });
        if (!s) throw new NotFoundException('Supplier not found.');
        return s;
    }

    async createSupplier(dto: CreateSupplierDto) {
        return ErpSupplier.create({ ...dto } as any);
    }

    async updateSupplier(id: number, dto: UpdateSupplierDto) {
        const s = await ErpSupplier.findByPk(id);
        if (!s) throw new NotFoundException('Supplier not found.');
        await s.update(dto as any);
        return s;
    }

    // ─── Purchase Orders ──────────────────────────────────────────────────────

    async getPurchaseOrders(supplier_id?: number, status?: PurchaseOrderStatus) {
        const where: any = {};
        if (supplier_id) where.supplier_id = supplier_id;
        if (status)      where.status = status;
        return ErpPurchaseOrder.findAll({
            where,
            include: [ErpSupplier, ErpPurchaseOrderItem],
            order  : [['created_at', 'DESC']],
        });
    }

    async getPurchaseOrder(id: number) {
        const po = await ErpPurchaseOrder.findByPk(id, {
            include: [
                ErpSupplier,
                { model: ErpPurchaseOrderItem, include: [MenuIngredient] },
            ],
        });
        if (!po) throw new NotFoundException('Purchase order not found.');
        return po;
    }

    /**
     * Creates a PO and its line items.
     * Purchase Total = Σ(Item Cost × Quantity)
     */
    async createPurchaseOrder(dto: CreatePurchaseOrderDto, creator_id: number) {
        const supplier = await ErpSupplier.findByPk(dto.supplier_id);
        if (!supplier) throw new BadRequestException('Supplier not found.');

        const poNumber  = `PO-${Date.now()}`;
        let totalAmount = 0;

        const transaction = await ErpPurchaseOrder.sequelize.transaction();
        try {
            const po = await ErpPurchaseOrder.create({
                po_number    : poNumber,
                supplier_id  : dto.supplier_id,
                order_date   : dto.order_date,
                expected_date: dto.expected_date,
                status       : PurchaseOrderStatus.DRAFT,
                total_amount : 0,
                created_by   : creator_id,
                notes        : dto.notes,
            } as any, { transaction });

            for (const item of dto.items) {
                const total = item.quantity * item.unit_cost;
                totalAmount += total;
                await ErpPurchaseOrderItem.create({
                    po_id              : po.id,
                    ingredient_id      : item.ingredient_id,
                    item_name          : item.item_name,
                    quantity           : item.quantity,
                    received_quantity  : 0,
                    unit               : item.unit,
                    unit_cost          : item.unit_cost,
                    total_cost         : total,
                } as any, { transaction });
            }

            await po.update({ total_amount: totalAmount }, { transaction });
            await transaction.commit();
            return this.getPurchaseOrder(po.id);
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }

    async updatePOStatus(id: number, dto: UpdatePOStatusDto) {
        const po = await ErpPurchaseOrder.findByPk(id);
        if (!po) throw new NotFoundException('Purchase order not found.');
        await po.update({ status: dto.status });
        return po;
    }

    /**
     * Record goods received against a PO.
     * Updates ingredient stock (quantity) and ingredient unit_cost.
     * Sets PO status to PARTIAL or RECEIVED accordingly.
     */
    async receiveGoods(po_id: number, dto: ReceiveGoodsDto) {
        const po = await ErpPurchaseOrder.findByPk(po_id, {
            include: [ErpPurchaseOrderItem],
        });
        if (!po) throw new NotFoundException('Purchase order not found.');
        if (po.status === PurchaseOrderStatus.CANCELLED) {
            throw new BadRequestException('Cannot receive goods on a cancelled PO.');
        }

        const transaction = await ErpPurchaseOrder.sequelize.transaction();
        try {
            for (const recv of dto.items) {
                const poItem = po.items.find(i => i.id === recv.item_id);
                if (!poItem) throw new BadRequestException(`PO item ${recv.item_id} not found.`);
                if (recv.received_quantity < 0) throw new BadRequestException('Received quantity cannot be negative.');

                const newReceived = Number(poItem.received_quantity) + recv.received_quantity;
                await poItem.update({ received_quantity: newReceived }, { transaction });

                // Update ingredient stock if linked
                if (poItem.ingredient_id) {
                    const ingredient = await MenuIngredient.findByPk(poItem.ingredient_id, { transaction });
                    if (ingredient) {
                        const newQty = Number(ingredient.quantity) + recv.received_quantity;
                        await ingredient.update({
                            quantity  : newQty,
                            unit_cost : poItem.unit_cost, // update cost with latest purchase price
                        }, { transaction });
                    }
                }
            }

            // Determine new PO status
            const updatedItems = await ErpPurchaseOrderItem.findAll({ where: { po_id }, transaction });
            const allReceived  = updatedItems.every(i => Number(i.received_quantity) >= Number(i.quantity));
            const anyReceived  = updatedItems.some(i => Number(i.received_quantity) > 0);

            const newStatus = allReceived
                ? PurchaseOrderStatus.RECEIVED
                : anyReceived
                    ? PurchaseOrderStatus.PARTIAL
                    : po.status;

            await po.update({ status: newStatus, received_date: dto.received_date }, { transaction });
            await transaction.commit();
            return this.getPurchaseOrder(po_id);
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }
}
