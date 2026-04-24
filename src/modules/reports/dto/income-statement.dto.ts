import { ApiProperty } from "@nestjs/swagger";

class PeriodDto {
  @ApiProperty({ example: "2025-01-01" })
  from!: string;

  @ApiProperty({ example: "2025-01-31" })
  to!: string;
}

class RevenueSection {
  @ApiProperty({ example: 1500.0, description: "Subscription Revenue" })
  subscriptionRevenue!: number;
}

export class IncomeStatementDto {
  @ApiProperty({ type: PeriodDto })
  period!: PeriodDto;

  @ApiProperty({ type: RevenueSection })
  revenue!: RevenueSection;

  @ApiProperty({ example: 1500.0, description: "Total revenue for period" })
  totalRevenue!: number;
}
