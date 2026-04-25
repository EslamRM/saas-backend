import { IsOptional, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ["PENDING", "PAID"],
    description: "Filter by status",
  })
  @IsOptional()
  @IsEnum(["PENDING", "PAID"])
  status?: string;
}
