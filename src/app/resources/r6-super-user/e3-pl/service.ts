import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import ErpExpenseCategory from '@app/models/erp/expense-category.model';
import ErpOperatingExpense from '@app/models/erp/operating-expense.model';
import ErpPayroll, { PayrollStatus } from '@app/models/erp/payroll.model';
import ErpPayrollItem from '@app/models/erp/payroll-item.model';
import { ProfitService } from '@app/services/profit.service';
import {
    CreateExpenseCategoryDto, CreateExpenseDto,
    PLReportQueryDto, UpdateExpenseCategoryDto,
} from './dto';

@Injectable()
export class PLService {

    constructor(private readonly profitService: ProfitService) {}

    // ─── Expense Categories ───────────────────────────────────────────────────

    async getCategories() {
        const rows = await ErpExpenseCategory.findAll({ order: [['name', 'ASC']] });
        return { data: rows };
    }

    async createCategory(dto: CreateExpenseCategoryDto) {
        const row = await ErpExpenseCategory.create({ ...dto } as any);
        return { data: row, message: 'Category created.' };
    }

    async updateCategory(id: number, dto: UpdateExpenseCategoryDto) {
        const cat = await ErpExpenseCategory.findByPk(id);
        if (!cat) throw new NotFoundException('Category not found.');
        await cat.update(dto as any);
        return { data: cat, message: 'Category updated.' };
    }

    async deleteCategory(id: number) {
        const cat = await ErpExpenseCategory.findByPk(id);
        if (!cat) throw new NotFoundException('Category not found.');
        await cat.destroy();
        return { message: 'Category deleted.' };
    }

    // ─── Operating Expenses ───────────────────────────────────────────────────

    async getExpenses(start_date?: string, end_date?: string, category_id?: number) {
        const where: any = {};
        if (category_id) where.category_id = category_id;
        if (start_date && end_date) {
            where.date = { [Op.between]: [start_date, end_date] };
        } else if (start_date) {
            where.date = { [Op.gte]: start_date };
        }
        const rows = await ErpOperatingExpense.findAll({
            where,
            include: [ErpExpenseCategory],
            order  : [['date', 'DESC']],
        });
        return { data: rows };
    }

    async createExpense(dto: CreateExpenseDto, creator_id: number) {
        const cat = await ErpExpenseCategory.findByPk(dto.category_id);
        if (!cat) throw new BadRequestException('Expense category not found.');
        const row = await ErpOperatingExpense.create({ ...dto, created_by: creator_id } as any);
        return { data: row, message: 'Expense created.' };
    }

    async deleteExpense(id: number) {
        const exp = await ErpOperatingExpense.findByPk(id);
        if (!exp) throw new NotFoundException('Expense not found.');
        await exp.destroy();
        return { message: 'Expense deleted.' };
    }

    // ─── Full P&L Report ──────────────────────────────────────────────────────

    /**
     * Full Profit & Loss statement for a given date range.
     */
    async getPLReport(query: PLReportQueryDto) {
        if (query.start_date > query.end_date) {
            throw new BadRequestException('start_date must be before end_date.');
        }

        const startDate = new Date(query.start_date);
        const endDate   = new Date(query.end_date);
        endDate.setHours(23, 59, 59, 999);

        const coreMetrics = await this.profitService.calculate(startDate, endDate);

        const expenses = await ErpOperatingExpense.findAll({
            where  : { date: { [Op.between]: [query.start_date, query.end_date] } },
            include: [ErpExpenseCategory],
        });
        const totalOpEx = expenses.reduce((s, e) => s + Number(e.amount), 0);

        const payrolls = await ErpPayroll.findAll({
            where: {
                status      : { [Op.in]: [PayrollStatus.FINALIZED, PayrollStatus.PAID] },
                period_start: { [Op.lte]: query.end_date },
                period_end  : { [Op.gte]: query.start_date },
            },
            include: [ErpPayrollItem],
        });
        const payrollCost = payrolls.reduce((s, p) => s + Number(p.total_amount), 0);

        const totalOpExIncludingPayroll = totalOpEx + payrollCost;
        const netProfit      = coreMetrics.gross_profit - totalOpExIncludingPayroll;
        const netMarginPct   = coreMetrics.revenue > 0
            ? (netProfit / coreMetrics.revenue) * 100
            : 0;

        return {
            data: {
                start_date        : query.start_date,
                end_date          : query.end_date,
                revenue           : this._round(coreMetrics.revenue),
                cogs              : this._round(coreMetrics.cogs),
                gross_profit      : this._round(coreMetrics.gross_profit),
                gross_margin_pct  : this._round(coreMetrics.gross_margin_pct),
                operating_expenses: this._round(totalOpEx),
                payroll_cost      : this._round(payrollCost),
                net_profit        : this._round(netProfit),
                net_margin_pct    : this._round(netMarginPct),
            },
        };
    }

    private _round(v: number, d = 2) {
        return parseFloat(v.toFixed(d));
    }
}
