import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCustomerDto {
  @ApiProperty({ example: "Alice Johnson", description: "Customer name" })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: "alice@example.com",
    description: "Customer email (unique within tenant)",
  })
  @IsEmail()
  email!: string;
}
