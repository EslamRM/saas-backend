import { ApiProperty } from "@nestjs/swagger";

export class SubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  planId!: string;

  @ApiProperty()
  planName!: string;

  @ApiProperty({ enum: ["ACTIVE", "CANCELLED"] })
  status!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  nextBillingDate!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
