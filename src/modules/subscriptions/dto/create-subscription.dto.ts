import { IsDateString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateSubscriptionDto {
  @ApiProperty({ example: "uuid", description: "Customer ID" })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: "uuid", description: "Plan ID" })
  @IsUUID()
  planId!: string;

  @ApiProperty({
    example: "2025-01-01",
    description: "Subscription start date (YYYY-MM-DD)",
  })
  @IsDateString()
  startDate!: string;
}
