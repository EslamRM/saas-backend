import { IsNumber, IsUUID, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreatePaymentDto {
  @ApiProperty({ example: "uuid", description: "Invoice ID to pay" })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({
    example: 100.0,
    description: "Payment amount (must match invoice amount)",
  })
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
