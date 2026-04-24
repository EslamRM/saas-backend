import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { TenantInterceptor } from "@/common/interceptors/tenant.interceptor";
import { UseInterceptors } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";

@ApiTags("Payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Record a payment for an invoice",
    description:
      "Creates payment, marks invoice as PAID, and triggers accounting journal entry (Debit Cash, Credit A/R). All in one transaction.",
  })
  @ApiResponse({ status: 201, type: PaymentResponseDto })
  @ApiResponse({
    status: 400,
    description: "Invoice already paid or not found",
  })
  async create(@Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    return this.paymentsService.createPayment(dto);
  }
}
