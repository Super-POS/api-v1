// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User from '@app/models/user/user.model';

@Table({ tableName: 'my_profile', timestamps: true })
class MyProfile extends Model<MyProfile> {
    
    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => User) @Column({ onDelete: 'CASCADE' })                                        creator_id: number;
    
    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.STRING })                                            title: string;
    @Column({ allowNull: false, type: DataType.STRING })                                            first_name: string;
    @Column({ allowNull: false, type: DataType.STRING })                                            last_name: string;
    @Column({ allowNull: true, type: DataType.STRING })                                             phone: string;
    @Column({ allowNull: true, type: DataType.STRING })                                             school: string;
    @Column({ allowNull: true, type: DataType.INTEGER })                                            year: number;

    // ============================================================================================= Many to One
    @BelongsTo(() => User)                                                                          user: User;

}

export default MyProfile;