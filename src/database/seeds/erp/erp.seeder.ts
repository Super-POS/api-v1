import ErpEmployee, {
    EmployeeContractType,
    EmployeeStatus,
} from '@app/models/erp/employee.model';
import ErpAttendance, { AttendanceStatus } from '@app/models/erp/attendance.model';
import ErpLeave, { LeaveStatus, LeaveType } from '@app/models/erp/leave.model';
import ErpPayroll, { PayrollStatus } from '@app/models/erp/payroll.model';
import ErpPayrollItem from '@app/models/erp/payroll-item.model';
import ErpSupplier from '@app/models/erp/supplier.model';
import ErpPurchaseOrder, { PurchaseOrderStatus } from '@app/models/erp/purchase-order.model';
import ErpPurchaseOrderItem from '@app/models/erp/purchase-order-item.model';
import ErpExpenseCategory, { ExpenseType } from '@app/models/erp/expense-category.model';
import ErpOperatingExpense from '@app/models/erp/operating-expense.model';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns all YYYY-MM-DD weekday strings in [start, end] inclusive. */
function weekdays(start: string, end: string): string[] {
    const days: string[] = [];
    const cur = new Date(start + 'T00:00:00Z');
    const last = new Date(end + 'T00:00:00Z');
    while (cur <= last) {
        const dow = cur.getUTCDay();
        if (dow !== 0 && dow !== 6) {
            days.push(cur.toISOString().slice(0, 10));
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return days;
}

// ─────────────────────────────────────────────────────────────────────────────

export class ErpSeeder {

    public static seed = async () => {
        try {
            await ErpSeeder._seedExpenseCategories();
            await ErpSeeder._seedSuppliers();
            await ErpSeeder._seedEmployees();
            await ErpSeeder._seedAttendance();
            await ErpSeeder._seedLeaves();
            await ErpSeeder._seedPayrolls();
            await ErpSeeder._seedPurchaseOrders();
            await ErpSeeder._seedOperatingExpenses();
        } catch (error) {
            console.error('\x1b[31m\nError seeding ERP data:', error);
            throw error;
        }
    };

    // ── 1. Expense categories ──────────────────────────────────────────────

    private static async _seedExpenseCategories() {
        await ErpExpenseCategory.bulkCreate([
            { name: 'Rent',                   type: ExpenseType.FIXED,    description: 'Monthly store / office rent' },
            { name: 'Utilities',              type: ExpenseType.VARIABLE, description: 'Electricity, water, internet' },
            { name: 'Salaries',               type: ExpenseType.FIXED,    description: 'Staff payroll disbursements' },
            { name: 'Marketing & Promotion',  type: ExpenseType.VARIABLE, description: 'Ads, banners, social media boosts' },
            { name: 'Supplies & Consumables', type: ExpenseType.VARIABLE, description: 'Packaging, stationery, cleaning supplies' },
            { name: 'Maintenance & Repair',   type: ExpenseType.VARIABLE, description: 'Equipment servicing, building repairs' },
        ]);
        console.log('\x1b[32mERP expense categories inserted successfully.');
    }

    // ── 2. Suppliers ──────────────────────────────────────────────────────

    private static async _seedSuppliers() {
        await ErpSupplier.bulkCreate([
            {
                name           : 'ABC Ingredients Supply',
                contact_person : 'Sok Vanna',
                phone          : '0123456789',
                email          : 'sokv@abcingredients.com',
                address        : '12 St. 271, Phnom Penh',
                payment_terms  : 'Net 30 days',
                is_active      : true,
                notes          : 'Primary dry-goods and spice supplier',
            },
            {
                name           : 'Fresh Food Co.',
                contact_person : 'Chan Dara',
                phone          : '0987654321',
                email          : 'dara@freshfoodco.com',
                address        : '45 National Road 6, Phnom Penh',
                payment_terms  : 'Cash on delivery',
                is_active      : true,
                notes          : 'Daily fresh produce and dairy',
            },
            {
                name           : 'Office & Packaging Plus',
                contact_person : 'Lim Kosal',
                phone          : '0769988776',
                email          : 'kosal@opp.com.kh',
                address        : '88 Monivong Blvd, Phnom Penh',
                payment_terms  : 'Net 15 days',
                is_active      : true,
                notes          : 'Take-away cups, lids, boxes, office supplies',
            },
            {
                name           : 'Tech Equipment Ltd.',
                contact_person : 'Meng Rathana',
                phone          : '0855512345',
                email          : 'rathana@techequip.kh',
                address        : '3 St. 63, Phnom Penh',
                payment_terms  : 'Net 30 days',
                is_active      : false,
                notes          : 'POS hardware and accessories (inactive)',
            },
        ]);
        console.log('\x1b[32mERP suppliers inserted successfully.');
    }

    // ── 3. Employees (linked to seeded staff users 1 – 3) ─────────────────

    private static async _seedEmployees() {
        await ErpEmployee.bulkCreate([
            {
                user_id       : 1,
                position      : 'Store Manager',
                department    : 'Management',
                base_salary   : 800,
                hourly_rate   : 5,
                hire_date     : '2023-01-15',
                contract_type : EmployeeContractType.FULL_TIME,
                bank_account  : '0001234567',
                bank_name     : 'ABA Bank',
                status        : EmployeeStatus.ACTIVE,
            },
            {
                user_id       : 2,
                position      : 'Cashier',
                department    : 'Operations',
                base_salary   : 400,
                hourly_rate   : 3,
                hire_date     : '2023-03-01',
                contract_type : EmployeeContractType.FULL_TIME,
                bank_account  : '0009876543',
                bank_name     : 'Wing Bank',
                status        : EmployeeStatus.ACTIVE,
            },
            {
                user_id       : 3,
                position      : 'Cashier',
                department    : 'Operations',
                base_salary   : 400,
                hourly_rate   : 3,
                hire_date     : '2024-06-01',
                contract_type : EmployeeContractType.PART_TIME,
                bank_account  : null,
                bank_name     : null,
                status        : EmployeeStatus.ACTIVE,
            },
        ]);
        console.log('\x1b[32mERP employees inserted successfully.');
    }

    // ── 4. Attendance – April & May 2026 weekdays ─────────────────────────

    private static async _seedAttendance() {
        const days = weekdays('2026-04-01', '2026-05-23');
        const rows: object[] = [];

        // Simulate realistic attendance for 3 employees
        // emp-1 overrides keyed by date
        const emp1Overrides: Record<string, AttendanceStatus> = {
            '2026-04-07': AttendanceStatus.ON_LEAVE,  // sick day
            '2026-05-04': AttendanceStatus.ON_LEAVE,  // annual leave
            '2026-05-05': AttendanceStatus.ON_LEAVE,  // annual leave
        };

        for (const day of days) {
            // Employee 1 (id: 1)
            const emp1Status = emp1Overrides[day] ?? AttendanceStatus.PRESENT;
            rows.push({
                employee_id   : 1,
                date          : day,
                clock_in      : emp1Status === AttendanceStatus.ON_LEAVE ? null : '08:00:00',
                clock_out     : emp1Status === AttendanceStatus.ON_LEAVE ? null : '17:00:00',
                hours_worked  : emp1Status === AttendanceStatus.ON_LEAVE ? 0 : 9,
                overtime_hours: 0,
                status        : emp1Status,
            });

            // Employee 2 (id: 2)
            const emp2Status = day === '2026-04-14'
                ? AttendanceStatus.ABSENT
                : day === '2026-05-12'
                    ? AttendanceStatus.HALF_DAY
                    : AttendanceStatus.PRESENT;
            rows.push({
                employee_id   : 2,
                date          : day,
                clock_in      : emp2Status === AttendanceStatus.ABSENT ? null : '08:00:00',
                clock_out     : emp2Status === AttendanceStatus.ABSENT ? null : emp2Status === AttendanceStatus.HALF_DAY ? '12:00:00' : '17:00:00',
                hours_worked  : emp2Status === AttendanceStatus.ABSENT ? 0 : emp2Status === AttendanceStatus.HALF_DAY ? 4 : 9,
                overtime_hours: day === '2026-04-30' ? 2 : 0,
                status        : emp2Status,
            });

            // Employee 3 (id: 3) – part-time, works Mon/Wed/Fri only
            const dow  = new Date(day + 'T00:00:00Z').getUTCDay();
            const work = dow === 1 || dow === 3 || dow === 5;
            // 2026-04-21 is a Tuesday so emp-3 wouldn't be working anyway; mark late on nearest Mon
            const emp3Late = day === '2026-04-20';
            rows.push({
                employee_id   : 3,
                date          : day,
                clock_in      : !work ? null : emp3Late ? '09:15:00' : '08:00:00',
                clock_out     : work ? '14:00:00' : null,
                hours_worked  : !work ? 0 : emp3Late ? 4.75 : 6,
                overtime_hours: 0,
                status        : !work ? AttendanceStatus.HOLIDAY : emp3Late ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
            });
        }

        await ErpAttendance.bulkCreate(rows);
        console.log('\x1b[32mERP attendance records inserted successfully.');
    }

    // ── 5. Leaves ─────────────────────────────────────────────────────────

    private static async _seedLeaves() {
        await ErpLeave.bulkCreate([
            {
                employee_id      : 1,
                type             : LeaveType.ANNUAL,
                start_date       : '2026-05-04',
                end_date         : '2026-05-05',
                days             : 2,
                reason           : 'Family trip',
                status           : LeaveStatus.APPROVED,
                approved_by      : 1,
                rejection_reason : null,
            },
            {
                employee_id      : 2,
                type             : LeaveType.SICK,
                start_date       : '2026-04-14',
                end_date         : '2026-04-14',
                days             : 1,
                reason           : 'Fever',
                status           : LeaveStatus.APPROVED,
                approved_by      : 1,
                rejection_reason : null,
            },
            {
                employee_id      : 2,
                type             : LeaveType.ANNUAL,
                start_date       : '2026-06-02',
                end_date         : '2026-06-04',
                days             : 3,
                reason           : 'Personal reasons',
                status           : LeaveStatus.PENDING,
                approved_by      : null,
                rejection_reason : null,
            },
            {
                employee_id      : 3,
                type             : LeaveType.UNPAID,
                start_date       : '2026-04-21',
                end_date         : '2026-04-21',
                days             : 0.5,
                reason           : 'Late arrival — partial unpaid',
                status           : LeaveStatus.APPROVED,
                approved_by      : 1,
                rejection_reason : null,
            },
        ]);
        console.log('\x1b[32mERP leave records inserted successfully.');
    }

    // ── 6. Payrolls (April + May 2026) ────────────────────────────────────

    private static async _seedPayrolls() {
        // April payroll – finalized
        const april = await ErpPayroll.create({
            period_start : '2026-04-01',
            period_end   : '2026-04-30',
            total_amount : 0,
            status       : PayrollStatus.FINALIZED,
            created_by   : 1,
            notes        : 'April 2026 payroll',
        });

        const aprilItems = [
            // emp 1 – manager, 1 sick day → 1 day deducted
            {
                payroll_id      : april.id,
                employee_id     : 1,
                base_salary     : 800,
                overtime_hours  : 0,
                overtime_pay    : 0,
                working_days    : 22,
                attended_days   : 21,
                leave_days      : 1,
                leave_deduction : 36.36,  // 800/22 * 1
                other_deductions: 0,
                net_salary      : 763.64,
                notes           : '1 sick day deducted',
            },
            // emp 2 – cashier, 1 absent (no pay) + 2h overtime last day
            {
                payroll_id      : april.id,
                employee_id     : 2,
                base_salary     : 400,
                overtime_hours  : 2,
                overtime_pay    : 9,      // 2 × 3 × 1.5
                working_days    : 22,
                attended_days   : 21,
                leave_days      : 1,
                leave_deduction : 18.18,  // 400/22 * 1
                other_deductions: 0,
                net_salary      : 390.82,
                notes           : '1 absent day + 2h overtime',
            },
            // emp 3 – part-time, ~10 working days (Mon/Wed/Fri only) × 6h
            {
                payroll_id      : april.id,
                employee_id     : 3,
                base_salary     : 400,
                overtime_hours  : 0,
                overtime_pay    : 0,
                working_days    : 10,
                attended_days   : 9,
                leave_days      : 0.5,
                leave_deduction : 20,
                other_deductions: 0,
                net_salary      : 380,
                notes           : '0.5 unpaid leave (late)',
            },
        ];
        await ErpPayrollItem.bulkCreate(aprilItems);
        const aprilTotal = aprilItems.reduce((s, i) => s + i.net_salary, 0);
        await april.update({ total_amount: Math.round(aprilTotal * 100) / 100 });

        // May payroll – draft (current month)
        const may = await ErpPayroll.create({
            period_start : '2026-05-01',
            period_end   : '2026-05-31',
            total_amount : 0,
            status       : PayrollStatus.DRAFT,
            created_by   : 1,
            notes        : 'May 2026 payroll – in progress',
        });

        const mayItems = [
            {
                payroll_id      : may.id,
                employee_id     : 1,
                base_salary     : 800,
                overtime_hours  : 0,
                overtime_pay    : 0,
                working_days    : 21,
                attended_days   : 19,
                leave_days      : 2,
                leave_deduction : 76.19,  // 800/21 * 2
                other_deductions: 0,
                net_salary      : 723.81,
                notes           : '2 annual leave days',
            },
            {
                payroll_id      : may.id,
                employee_id     : 2,
                base_salary     : 400,
                overtime_hours  : 0,
                overtime_pay    : 0,
                working_days    : 21,
                attended_days   : 20,
                leave_days      : 0.5,
                leave_deduction : 9.52,
                other_deductions: 0,
                net_salary      : 390.48,
                notes           : '0.5 half-day leave',
            },
            {
                payroll_id      : may.id,
                employee_id     : 3,
                base_salary     : 400,
                overtime_hours  : 0,
                overtime_pay    : 0,
                working_days    : 9,
                attended_days   : 9,
                leave_days      : 0,
                leave_deduction : 0,
                other_deductions: 0,
                net_salary      : 400,
                notes           : null,
            },
        ];
        await ErpPayrollItem.bulkCreate(mayItems);
        const mayTotal = mayItems.reduce((s, i) => s + i.net_salary, 0);
        await may.update({ total_amount: Math.round(mayTotal * 100) / 100 });

        console.log('\x1b[32mERP payrolls inserted successfully.');
    }

    // ── 7. Purchase orders ────────────────────────────────────────────────

    private static async _seedPurchaseOrders() {
        // PO-001 – dry ingredients, fully received
        const po1 = await ErpPurchaseOrder.create({
            po_number    : 'PO-2026-001',
            supplier_id  : 1,
            order_date   : '2026-04-05',
            expected_date: '2026-04-10',
            received_date: '2026-04-09',
            total_amount : 185.50,
            status       : PurchaseOrderStatus.RECEIVED,
            created_by   : 1,
            notes        : 'Monthly dry goods restock',
        });
        await ErpPurchaseOrderItem.bulkCreate([
            { po_id: po1.id, item_name: 'Coffee Beans (Robusta 1 kg)',  quantity: 10, received_quantity: 10, unit: 'kg',  unit_cost: 8.50,  total_cost: 85.00  },
            { po_id: po1.id, item_name: 'Sugar (1 kg bag)',              quantity: 20, received_quantity: 20, unit: 'kg',  unit_cost: 0.90,  total_cost: 18.00  },
            { po_id: po1.id, item_name: 'Whole Milk Powder (500 g)',     quantity: 15, received_quantity: 15, unit: 'pcs', unit_cost: 2.50,  total_cost: 37.50  },
            { po_id: po1.id, item_name: 'Vanilla Syrup (750 ml)',        quantity: 5,  received_quantity: 5,  unit: 'btl', unit_cost: 9.00,  total_cost: 45.00  },
        ]);

        // PO-002 – fresh produce, partial delivery
        const po2 = await ErpPurchaseOrder.create({
            po_number    : 'PO-2026-002',
            supplier_id  : 2,
            order_date   : '2026-04-20',
            expected_date: '2026-04-22',
            received_date: null,
            total_amount : 132.00,
            status       : PurchaseOrderStatus.PARTIAL,
            created_by   : 1,
            notes        : 'Fresh produce for April week-4',
        });
        await ErpPurchaseOrderItem.bulkCreate([
            { po_id: po2.id, item_name: 'Fresh Milk (1 L)',       quantity: 30, received_quantity: 20, unit: 'L',   unit_cost: 1.80, total_cost: 54.00 },
            { po_id: po2.id, item_name: 'Eggs (dozen)',            quantity: 10, received_quantity: 10, unit: 'doz', unit_cost: 2.20, total_cost: 22.00 },
            { po_id: po2.id, item_name: 'Butter (250 g unsalted)', quantity: 12, received_quantity: 8,  unit: 'pcs', unit_cost: 2.50, total_cost: 30.00 },
            { po_id: po2.id, item_name: 'Heavy Cream (500 ml)',    quantity: 8,  received_quantity: 0,  unit: 'pcs', unit_cost: 3.25, total_cost: 26.00 },
        ]);

        // PO-003 – packaging, ordered / awaiting delivery
        const po3 = await ErpPurchaseOrder.create({
            po_number    : 'PO-2026-003',
            supplier_id  : 3,
            order_date   : '2026-05-10',
            expected_date: '2026-05-15',
            received_date: null,
            total_amount : 98.00,
            status       : PurchaseOrderStatus.ORDERED,
            created_by   : 1,
            notes        : 'Take-away packaging restock',
        });
        await ErpPurchaseOrderItem.bulkCreate([
            { po_id: po3.id, item_name: 'Paper Cups 12 oz (50 pcs)',    quantity: 10, received_quantity: 0, unit: 'pck', unit_cost: 4.50,  total_cost: 45.00 },
            { po_id: po3.id, item_name: 'Plastic Lids (100 pcs)',        quantity: 5,  received_quantity: 0, unit: 'pck', unit_cost: 2.20,  total_cost: 11.00 },
            { po_id: po3.id, item_name: 'Kraft Paper Bags (50 pcs)',     quantity: 6,  received_quantity: 0, unit: 'pck', unit_cost: 3.00,  total_cost: 18.00 },
            { po_id: po3.id, item_name: 'Thermal Receipt Paper (80 mm)', quantity: 8,  received_quantity: 0, unit: 'rol', unit_cost: 3.00,  total_cost: 24.00 },
        ]);

        console.log('\x1b[32mERP purchase orders inserted successfully.');
    }

    // ── 8. Operating expenses ─────────────────────────────────────────────

    private static async _seedOperatingExpenses() {
        // category IDs match insertion order above: 1=Rent, 2=Utilities, 3=Salaries,
        // 4=Marketing, 5=Supplies, 6=Maintenance
        const rows = [
            // ── April 2026 ──────────────────────────────────────────────────
            { category_id: 1, amount: 500,   currency: 'USD', date: '2026-04-01', description: 'April 2026 – store rent',           reference: 'RNT-APR-2026', created_by: 1 },
            { category_id: 2, amount: 128.50, currency: 'USD', date: '2026-04-30', description: 'April electricity & internet bill', reference: 'UTL-APR-2026', created_by: 1 },
            { category_id: 3, amount: 1534.46,currency: 'USD', date: '2026-04-30', description: 'April payroll disbursement',         reference: 'PAY-APR-2026', created_by: 1 },
            { category_id: 4, amount: 150,   currency: 'USD', date: '2026-04-15', description: 'Social media ads – April',           reference: 'MKT-APR-2026', created_by: 1 },
            { category_id: 5, amount: 68.80, currency: 'USD', date: '2026-04-20', description: 'Cleaning supplies & office stationery', reference: 'SUP-APR-2026', created_by: 1 },
            { category_id: 6, amount: 45,    currency: 'USD', date: '2026-04-25', description: 'Espresso machine service',           reference: 'MNT-APR-2026', created_by: 1 },
            // ── May 2026 ────────────────────────────────────────────────────
            { category_id: 1, amount: 500,   currency: 'USD', date: '2026-05-01', description: 'May 2026 – store rent',              reference: 'RNT-MAY-2026', created_by: 1 },
            { category_id: 2, amount: 135,   currency: 'USD', date: '2026-05-20', description: 'May electricity & internet (partial)', reference: 'UTL-MAY-2026', created_by: 1 },
            { category_id: 4, amount: 200,   currency: 'USD', date: '2026-05-05', description: 'Grand-opening promo banner & flyers', reference: 'MKT-MAY-2026', created_by: 1 },
            { category_id: 5, amount: 98,    currency: 'USD', date: '2026-05-10', description: 'Packaging PO-2026-003 prepayment',    reference: 'PO-2026-003',   created_by: 1 },
        ];
        await ErpOperatingExpense.bulkCreate(rows);
        console.log('\x1b[32mERP operating expenses inserted successfully.');
    }
}
