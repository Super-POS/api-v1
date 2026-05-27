import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import UserDecorator from '@app/core/decorators/user.decorator';
import User from '@app/models/user/user.model';
import { PLService } from './service';
import {
    CreateExpenseCategoryDto, CreateExpenseDto,
    PLReportQueryDto, UpdateExpenseCategoryDto,
} from './dto';

@Controller()
export class PLController {
    constructor(private readonly _service: PLService) {}

    // ─── Expense Categories ───────────────────────────────────────────────────

    @Get('expense-categories')
    getCategories() {
        return this._service.getCategories();
    }

    @Post('expense-categories')
    createCategory(@Body() dto: CreateExpenseCategoryDto) {
        return this._service.createCategory(dto);
    }

    @Patch('expense-categories/:id')
    updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseCategoryDto) {
        return this._service.updateCategory(id, dto);
    }

    @Delete('expense-categories/:id')
    deleteCategory(@Param('id', ParseIntPipe) id: number) {
        return this._service.deleteCategory(id);
    }

    // ─── Operating Expenses ───────────────────────────────────────────────────

    @Get('expenses')
    getExpenses(
        @Query('start_date')  start_date?:  string,
        @Query('end_date')    end_date?:    string,
        @Query('category_id') category_id?: number,
    ) {
        return this._service.getExpenses(start_date, end_date, category_id);
    }

    @Post('expenses')
    createExpense(@Body() dto: CreateExpenseDto, @UserDecorator() auth: User) {
        return this._service.createExpense(dto, auth.id);
    }

    @Delete('expenses/:id')
    deleteExpense(@Param('id', ParseIntPipe) id: number) {
        return this._service.deleteExpense(id);
    }

    // ─── P&L Report ───────────────────────────────────────────────────────────

    @Get('report')
    getPLReport(@Query() query: PLReportQueryDto) {
        return this._service.getPLReport(query);
    }
}
