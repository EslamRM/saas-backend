import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccountingService } from "../accounting/accounting.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { TenantContext } from "../../common/tenant-context"; // FIX: Removed path alias

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  async createPayment(dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const tenantId = TenantContext.requireTenantId();

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId },
      });

      // FIX: Removed duplicate checks that were in your pasted code
      if (!invoice)
        throw new NotFoundException("Invoice not found for this tenant");
      if (invoice.status === "PAID")
        throw new BadRequestException("Invoice already paid");

      // FIX: Use String comparison to avoid JS floating point math bugs
      if (String(invoice.amount) !== String(dto.amount)) {
        throw new BadRequestException(
          `Payment amount (${dto.amount}) does not match invoice amount (${invoice.amount})`,
        );
      }

      const payment = await tx.payment.create({
        data: { tenantId, invoiceId: dto.invoiceId, amount: dto.amount },
      });

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: { status: "PAID" },
      });

      await this.accountingService.createJournalEntry(
        {
          tenantId,
          description: `Payment received for invoice ${invoice.id}`,
          referenceType: "PAYMENT",
          referenceId: payment.id,
          lines: [
            { accountCode: "1000", type: "DEBIT", amount: dto.amount },
            { accountCode: "1100", type: "CREDIT", amount: dto.amount },
          ],
        },
        tx as any,
      );

      return this.toResponseDto(payment);
    });
  }

  private toResponseDto(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: Number(payment.amount),
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }
}
