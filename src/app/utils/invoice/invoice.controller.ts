// ===========================================================================>> Core Library
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';

// ===========================================================================>> Costom Library
import { InvoiceService } from './invoice.service';

@Controller()
export class InvoiceController {
    
    constructor(private readonly _service: InvoiceService) { };

    @Get('order-invoice/:receiptNumber')
    async generateReport(@Param('receiptNumber') receiptNumber: string) {
        if (!/^\d{1,10}$/.test(receiptNumber)) {
            throw new BadRequestException('Receipt number must be 1 to 10 digits');
        }
        return this._service.generateReport(receiptNumber);
    }
}
