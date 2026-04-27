// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import ModifierOption from '@app/models/menu/modifier-option.model';
import OrderDetails from './detail.model';

/** Snapshot of chosen modifiers on a line (survives option/group renames/deletes). */
@Table({ tableName: 'order_detail_modifiers', createdAt: false, updatedAt: false })
class OrderDetailModifier extends Model<OrderDetailModifier> {
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    @ForeignKey(() => OrderDetails)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                    order_detail_id: number;

    @ForeignKey(() => ModifierOption)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                     modifier_option_id?: number;

    @Column({ allowNull: false, type: DataType.STRING(120) })                                     group_name: string;

    @Column({ allowNull: false, type: DataType.STRING(120) })                                     option_label: string;

    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })                  price_delta_applied: number;

    @BelongsTo(() => OrderDetails)                                                                orderDetail: OrderDetails;
    @BelongsTo(() => ModifierOption)                                                              option?: ModifierOption;
}

export default OrderDetailModifier;
