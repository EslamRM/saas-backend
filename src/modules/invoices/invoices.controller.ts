import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantInterceptor } from "../../common/interceptors/tenant.interceptor";
import { UseInterceptors } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { QueryInvoiceDto } from "./dto/query-invoice.dto";
import { InvoiceResponseDto } from "./dto/invoice-response.dto";

@ApiTags("Invoices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: "List all invoices with filtering" })
  async findAll(@Query() dto: QueryInvoiceDto): Promise<InvoiceResponseDto[]> {
    return this.invoicesService.findAll(dto);
  }
}
