import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RoomStatusEnum } from '@app/enums/room-status.enum';
import { RoomTypeEnum }   from '@app/enums/room-type.enum';

export class CreateRoomDto {
    @IsString() @IsNotEmpty()  name: string;
    @IsOptional() @IsString()  description?: string;
    @IsInt() @Min(1)           capacity: number;
    @IsOptional() @IsNumber()  price_per_hour?: number;
    @IsOptional() @IsEnum(RoomTypeEnum)   type?: RoomTypeEnum;
    @IsOptional() @IsEnum(RoomStatusEnum) status?: RoomStatusEnum;
    @IsOptional() @IsString()  notes?: string;
}

export class UpdateRoomDto {
    @IsOptional() @IsString()  name?: string;
    @IsOptional() @IsString()  description?: string;
    @IsOptional() @IsInt() @Min(1) capacity?: number;
    @IsOptional() @IsNumber()  price_per_hour?: number;
    @IsOptional() @IsEnum(RoomTypeEnum)   type?: RoomTypeEnum;
    @IsOptional() @IsEnum(RoomStatusEnum) status?: RoomStatusEnum;
    @IsOptional() @IsString()  notes?: string;
}
