import {
    IsDateString, IsEmail, IsInt, IsNotEmpty,
    IsOptional, IsPhoneNumber, IsString, Min, Matches,
} from 'class-validator';

export class CreateBookingDto {
    // Guest Information
    @IsString()  @IsNotEmpty()                        guest_name: string;
    @IsString()  @IsNotEmpty()                        guest_phone: string;
    @IsEmail()                                        guest_email: string;
    @IsOptional() @IsString()                         guest_origin?: string;

    // Booking Details
    @IsInt() @Min(1)                                  room_id: number;
    @IsDateString()                                   check_in_date: string;   // YYYY-MM-DD
    @IsDateString()                                   check_out_date: string;  // YYYY-MM-DD
    @Matches(/^\d{2}:\d{2}$/)                         meeting_start_time: string; // HH:MM
    @Matches(/^\d{2}:\d{2}$/)                         meeting_end_time: string;   // HH:MM
    @IsInt() @Min(1)                                  num_guests: number;
    @IsInt() @Min(1)                                  num_rooms: number;
    @IsOptional() @IsString()                         purpose?: string;

    // Payment
    @IsOptional() @IsString()                         payment_method?: string; // defaults to 'baray'

    // Special Requests
    @IsOptional() @IsString()                         notes?: string;
}
