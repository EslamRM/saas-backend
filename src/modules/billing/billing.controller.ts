import { Controller, Post, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "@/common/decorators/public.decorator";
import { BillingService } from "./billing.service";

@ApiTags("Billing")
@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("generate-monthly-invoices")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Generate monthly invoices for all tenants",
    description:
      "Simulates a monthly cron job. Finds all ACTIVE subscriptions where nextBillingDate <= today, creates invoices with accounting entries, and advances nextBillingDate.",
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: {
        generated: { type: "number", example: 5 },
        message: { type: "string" },
      },
    },
  })
  async generateMonthlyInvoices(): Promise<{
    generated: number;
    message: string;
  }> {
    const count = await this.billingService.generateMonthlyInvoices();
    return {
      generated: count,
      message: `${count} invoice(s) generated successfully`,
    };
  }
}
