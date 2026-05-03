import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** Single-row counter: `last_assigned` is the last issued display order number (1–100), cycling after 100. */
@Table({ tableName: 'order_sequence_counter', timestamps: false })
class OrderSequenceCounter extends Model<OrderSequenceCounter> {
    @Column({ primaryKey: true, type: DataType.TINYINT }) id: number;

    @Column({ allowNull: false, type: DataType.SMALLINT })
    last_assigned: number;
}

export default OrderSequenceCounter;
