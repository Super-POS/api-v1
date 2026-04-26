// =========================================================================>> Core Library
import { Controller, Get } from '@nestjs/common';

// =========================================================================>> Custom Library
import Menu                  from '@app/models/menu/menu.model';
import { CustomerOrderService } from '@app/resources/r5-customer/o1-order/service';

@Controller()
export class PublicMenuController {
    constructor(private readonly _customerOrder: CustomerOrderService) {}

    /** Public menu catalog (no auth) — same data as customer/cashier menu list. */
    @Get()
    async getMenu(): Promise<{ data: { id: number; name: string; menus: Menu[] }[] }> {
        return await this._customerOrder.getMenus();
    }
}
