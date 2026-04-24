import { IsString, IsNumber, IsInt, IsOptional, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePlanDto {
  @ApiProperty({ example: "Bronze Plan", description: "Plan name" })
  @IsString()
  name!: string;

  @ApiProperty({ example: 99.99, description: "Price per billing period" })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    example: "USD",
    description: "Currency code",
    default: "USD",
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 30, description: "Billing interval in days" })
  @IsInt()
  @Min(1)
  intervalDays!: number;
}
