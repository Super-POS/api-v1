// ===========================================================================>> Core Library
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';

// ===========================================================================>> Costom Library
import { SaleService }                                                 from './service';
@Controller()
export class SaleController {

    constructor(private readonly _service: SaleService) { };

    @Get('export/csv')
    async exportCsv(
        @Res() res: Response,
        @Query('key') key?: string,
        @Query('cashier') cashier?: string,
        @Query('channel') platform?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        const toDate = to ? `${to} 23:59:59` : undefined;
        const csv = await this._service.exportSalesCsv({
            key,
            cashier: cashier ? Number(cashier) : undefined,
            platform: platform || undefined,
            fromDate: from,
            toDate,
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sales-export.csv"');
        return res.send('\ufeff' + csv);
    }

    @Get('/setup')
    async getSetupData(){
        return await this._service.getSetupData();
    }
    
    @Get('/')
    async getData(

        //=========================>> Pagination
        @Query('page')    page?  : number,
        @Query('limit')   limit? : number,

        //=========================>> Search
        @Query('key')     key?   : string,

        //=========================>> Sort
        @Query("sort")      sort?  : string,
        @Query("order")     order?    : string,
        
        //=========================>> Filter
        @Query('cashier')   cashier?    : number,
        @Query('channel')   platform?   : string,
        @Query('from')      from?       : string,      
        @Query('to')        to?         : string,
        
    ) {

       // Set default value if not defined. 
        page    = !page ? 10: page; 
        limit   = !limit ? 10: limit;

        const fromDate  = from; 
        const toDate    = to ? to + ' 23:59:59' : undefined;

        const params = { 
            // ===>> Pagination
            page, 
            limit,

            // ===>> Filter
            key,
            cashier,
            platform,
            fromDate, 
            toDate,

            // ===>> Sort
            sort,
            order
        }

        return await this._service.getData(params);
    }
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async delete(@Param('id') id: number): Promise<{ message: string }> {
        return await this._service.delete(id);
    }
}