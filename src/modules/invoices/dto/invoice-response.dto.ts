import { ApiProperty } from "@nestjs/swagger";

export class InvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  subscriptionId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ example: 100.0 })
  amount!: number;

  @ApiProperty({ enum: ["PENDING", "PAID"] })
  status!: string;

  @ApiProperty()
  periodStart!: Date;

  @ApiProperty()
  periodEnd!: Date;

  @ApiProperty()
  createdAt!: Date;
}
