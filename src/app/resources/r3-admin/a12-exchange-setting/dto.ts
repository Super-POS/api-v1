import { IsNumber, Max, Min } from 'class-validator';

export class PatchExchangeRateDto {
    @IsNumber()
    @Min(1000)
    @Max(100000)
    khr_per_usd: number;
}
