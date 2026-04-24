import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterTenantDto {
  @ApiProperty({
    example: "Acme Corporation",
    description: "Company/tenant name",
    maxLength: 255,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  companyName!: string;

  @ApiProperty({
    example: "admin@acme.com",
    description: "Admin email (used for tenant contact and admin login)",
  })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({
    example: "SecurePass123!",
    description: "Admin password (minimum 8 characters)",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  adminPassword!: string;
}
