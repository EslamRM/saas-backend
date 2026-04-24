import { ApiProperty } from "@nestjs/swagger";

class AssetSection {
  @ApiProperty({ example: 1000.0, description: "Cash balance" })
  cash!: number;

  @ApiProperty({ example: 5000.0, description: "Accounts receivable" })
  accountsReceivable!: number;

  @ApiProperty({ example: 6000.0, description: "Total assets" })
  totalAssets!: number;
}

class LiabilitySection {
  @ApiProperty({ example: 2000.0, description: "Deferred revenue" })
  deferredRevenue!: number;

  @ApiProperty({ example: 2000.0, description: "Total liabilities" })
  totalLiabilities!: number;
}

export class BalanceSheetDto {
  @ApiProperty({ example: "2025-01-31", description: "Report date" })
  asOf!: string;

  @ApiProperty({ type: AssetSection })
  assets!: AssetSection;

  @ApiProperty({ type: LiabilitySection })
  liabilities!: LiabilitySection;
}