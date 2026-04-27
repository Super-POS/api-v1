// =========================================================================>> Core Library
import { BadRequestException } from '@nestjs/common';
// =========================================================================>> Third Party Library
import { Transaction } from 'sequelize';
// =========================================================================>> Custom Library
import Menu from '@app/models/menu/menu.model';
import MenuModifierGroup from '@app/models/menu/menu-modifier-group.model';
import ModifierGroup from '@app/models/menu/modifier-group.model';
import ModifierOption from '@app/models/menu/modifier-option.model';
import OrderDetailModifier from '@app/models/order/order-detail-modifier.model';
import OrderDetails from '@app/models/order/detail.model';

export type CartLineInput = {
    menuId: number;
    qty: number;
    modifier_option_ids: number[];
    line_note?: string;
};

/**
 * Read `sort_order` / `is_required` from the menu↔group junction (Sequelize may expose different keys).
 */
export function getThroughMeta(groupRow: any): { sortOrder: number; isRequired: boolean } {
    const t =
        groupRow?.MenuModifierGroup ??
        groupRow?.menuModifierGroup ??
        groupRow?.menu_modifier_group;
    const sortOrder = Number(
        t?.sort_order ?? groupRow?.MenuModifierGroup?.sort_order ?? groupRow?.menuModifierGroup?.sort_order ?? 0,
    );
    const isRequired = Boolean(
        t?.is_required
        ?? groupRow?.is_required
        ?? groupRow?.MenuModifierGroup?.is_required
        ?? groupRow?.menuModifierGroup?.is_required
        ?? false,
    );
    return { sortOrder, isRequired };
}

/** Per-menu `sort_order` on `menu_modifier_groups` must control display order, not `modifier_groups.sort_order`. */
export function sortMenuModifierGroupsInPlace(menu: { modifierGroups?: any[] } | null | undefined): void {
    const g = menu?.modifierGroups;
    if (!Array.isArray(g) || g.length < 2) {
        return;
    }
    g.sort(
        (a, b) => getThroughMeta(a).sortOrder - getThroughMeta(b).sortOrder,
    );
}

export function toPlainMenuWithSortedModifiers(m: any): any {
    const plain = typeof m?.get === 'function' ? m.get({ plain: true }) : m;
    if (plain && Array.isArray(plain.modifierGroups)) {
        sortMenuModifierGroupsInPlace(plain);
    }
    return plain;
}

/**
 * Parse cart JSON (array or legacy object) into lines with optional modifiers.
 */
export function normalizeCartLines(raw: unknown): CartLineInput[] {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const toLine = (rawItem: any, menuIdFallback?: string | number): CartLineInput | null => {
        const menuId = Number(
            rawItem?.menu_id ??
            (rawItem as { product_id?: number })?.product_id ??
            rawItem?.id ??
            menuIdFallback,
        );
        const qty = Number(rawItem?.quantity ?? rawItem?.qty ?? 0);
        const rawMod = rawItem?.modifier_option_ids ?? rawItem?.modifier_ids;
        let modifier_option_ids: number[] = [];
        if (Array.isArray(rawMod)) {
            modifier_option_ids = rawMod
                .map((n) => Number(n))
                .filter((n) => Number.isFinite(n) && n > 0);
        } else if (rawMod != null && rawMod !== '') {
            const n = Number(rawMod);
            if (Number.isFinite(n) && n > 0) modifier_option_ids = [n];
        }
        const line_note =
            typeof rawItem?.line_note === 'string' && rawItem.line_note.trim().length > 0
                ? rawItem.line_note.trim().slice(0, 500)
                : undefined;

        if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(qty) || qty <= 0) {
            return null;
        }
        return { menuId, qty, modifier_option_ids, line_note };
    };

    if (Array.isArray(parsed)) {
        return parsed.map((x) => toLine(x, undefined)).filter((x): x is CartLineInput => x != null);
    }

    if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed as Record<string, unknown>)
            .map(([id, value]) => {
                if (value && typeof value === 'object') {
                    return toLine(value, id);
                }
                return toLine(
                    { menu_id: id, qty: value, modifier_option_ids: undefined },
                    id,
                );
            })
            .filter((x): x is CartLineInput => x != null);
    }

    return [];
}

export type ModifierSnapshot = {
    modifier_option_id: number;
    group_name: string;
    option_label: string;
    price_delta_applied: number;
};

/**
 * Compute unit line price (base + selected modifiers) and validate rules:
 * at most one option per group, all options allowed for this menu, required groups satisfied.
 */
export async function buildLineModifiers(
    menu: Menu,
    modifierOptionIds: number[],
    transaction?: Transaction,
): Promise<{
    unitPrice: number;
    modifierDeltaPerUnit: number;
    snapshots: ModifierSnapshot[];
    selectedOptions: ModifierOption[];
}> {
    const base = Number(menu.unit_price ?? 0);
    const ids = Array.from(
        new Set(
            (modifierOptionIds || []).filter(
                (n) => Number.isFinite(n) && n > 0,
            ) as number[],
        ),
    );

    const links = await MenuModifierGroup.findAll({
        where: { menu_id: menu.id },
        transaction,
        include: [
            {
                model: ModifierGroup,
                as: 'modifierGroup',
                where: { is_active: true },
                required: true,
                include: [
                    {
                        model: ModifierOption,
                        as: 'options',
                        required: false,
                        where: { is_active: true },
                    },
                ],
            },
        ],
        order: [['sort_order', 'ASC']],
    });

    if (ids.length === 0) {
        for (const link of links) {
            if (link.is_required) {
                throw new BadRequestException(
                    `Menu "${menu.name}" requires a choice for "${link.modifierGroup?.name ?? 'modifier'}".`,
                );
            }
        }
        return { unitPrice: base, modifierDeltaPerUnit: 0, snapshots: [], selectedOptions: [] };
    }

    const allowedGroupIds = new Set(
        links.map((l) => l.modifier_group_id),
    );
    if (allowedGroupIds.size === 0 && ids.length > 0) {
        throw new BadRequestException(
            `This menu has no modifier groups; remove modifier_option_ids for "${menu.name}".`,
        );
    }

    const optionById = new Map<number, ModifierOption>();
    const groupById = new Map<number, ModifierGroup>();
    for (const link of links) {
        const g = link.modifierGroup;
        if (!g) continue;
        groupById.set(g.id, g);
        for (const o of (g as any).options || []) {
            if (o.is_active) {
                optionById.set(o.id, o);
            }
        }
    }

    const usedGroups = new Set<number>();
    const snapshots: ModifierSnapshot[] = [];
    const selectedOptions: ModifierOption[] = [];
    let deltaSum = 0;

    for (const oid of ids) {
        const opt = optionById.get(oid);
        if (!opt) {
            throw new BadRequestException(
                `Invalid or inactive modifier option #${oid} for menu "${menu.name}".`,
            );
        }
        if (!allowedGroupIds.has(opt.group_id)) {
            throw new BadRequestException(
                `Modifier option "${opt.label}" is not available for menu "${menu.name}".`,
            );
        }
        if (usedGroups.has(opt.group_id)) {
            const g = groupById.get(opt.group_id);
            throw new BadRequestException(
                `Only one choice allowed per group for "${g?.name ?? 'modifier'}".`,
            );
        }
        usedGroups.add(opt.group_id);
        const g = groupById.get(opt.group_id);
        if (!g) {
            throw new BadRequestException(`Modifier group missing for option #${oid}.`);
        }
        const d = Number(opt.price_delta ?? 0);
        deltaSum += d;
        selectedOptions.push(opt);
        snapshots.push({
            modifier_option_id: opt.id,
            group_name: g.name,
            option_label: opt.label,
            price_delta_applied: d,
        });
    }

    for (const link of links) {
        if (!link.is_required) continue;
        if (!usedGroups.has(link.modifier_group_id)) {
            const name = link.modifierGroup?.name ?? 'modifier';
            throw new BadRequestException(
                `Menu "${menu.name}" requires a choice for "${name}".`,
            );
        }
    }

    return {
        unitPrice: base + deltaSum,
        modifierDeltaPerUnit: deltaSum,
        snapshots,
        selectedOptions,
    };
}

export async function createDetailModifiers(
    orderDetailId: number,
    snapshots: ModifierSnapshot[],
    transaction?: Transaction,
): Promise<void> {
    if (snapshots.length === 0) return;
    await OrderDetailModifier.bulkCreate(
        snapshots.map((s) => ({
            order_detail_id: orderDetailId,
            modifier_option_id: s.modifier_option_id,
            group_name: s.group_name,
            option_label: s.option_label,
            price_delta_applied: s.price_delta_applied,
        })),
        { transaction },
    );
}

/** Include tree for menu catalog (types → menus + modifier groups + options). */
export function getMenuCatalogInclude() {
    return {
        model: ModifierGroup,
        as: 'modifierGroups',
        through: { attributes: ['sort_order', 'is_required'] },
        required: false,
        where: { is_active: true },
        include: [
            {
                model: ModifierOption,
                as: 'options',
                required: false,
                where: { is_active: true },
            },
        ],
    } as any;
}

