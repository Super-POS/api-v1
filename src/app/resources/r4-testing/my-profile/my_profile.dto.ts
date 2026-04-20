import { IsNotEmpty, IsNumber, IsPositive, IsString } from "class-validator";

export class MyProfileDto {

    @IsString({ message: "Please name is require" })
    @IsNotEmpty()
    title: string

    @IsString({ message: "Please first_name is require" })
    @IsNotEmpty()
    first_name: string

    @IsString({ message: "Please last_name is require" })
    @IsNotEmpty()
    last_name: string

    @IsString({ message: "Please phone is require" })
    @IsNotEmpty()
    phone: string

    @IsString({ message: "Please school is require" })
    @IsNotEmpty()
    school: string

    @IsNumber()
    @IsPositive()
    year: number
}
