import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RecognizeRevenueDto {
  @ApiPropertyOptional({
    example: '2025-01',
    description: 'Month to recognize revenue for (YYYY-MM format). Defaults to previous month.',
    pattern: '^\\d{4}-\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;
}