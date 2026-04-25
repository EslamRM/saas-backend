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
  @ApiOperation({ summary: "Generate monthly invoices (System Endpoint)", description: "Generates monthly invoices for all active subscriptions. This is a system endpoint and requires an API key. Do not expose this endpoint to the public. You should only call this endpoint if you are a system administrator. Provide the INTERNAL_API_KEY as the API key in the header as 'x-api-key'." })
  async generateMonthlyInvoices(): Promise<{
    generated: number;
    message: string;
  }> {
    const count = await this.billingService.generateMonthlyInvoices();
    return { generated: count, message: `${count} invoice(s) generated` };
  }
}
