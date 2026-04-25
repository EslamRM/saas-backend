import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import { ApiKeyGuard } from "../../common/guards/api-key.guard"; // FIX: ApiKey instead of Public
import { BillingService } from "./billing.service";

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("generate-monthly-invoices")
  @UseGuards(ApiKeyGuard) // FIX: Protected endpoint
  @ApiSecurity("api-key")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate monthly invoices (System Endpoint)" })
  async generateMonthlyInvoices(): Promise<{
    generated: number;
    message: string;
  }> {
    const count = await this.billingService.generateMonthlyInvoices();
    return { generated: count, message: `${count} invoice(s) generated` };
  }
}
