import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Alice Johnson" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: "alice@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;
}
