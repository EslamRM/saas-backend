import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccountingService } from "../accounting/accounting.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentResponseDto } from "./dto/payment-response.dto";
import { TenantContext } from "@/common/tenant-context";

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  /**
   * Records a payment and triggers accounting journal entry.
   * All operations in a single transaction for consistency.
   *
   * Journal Entry:
   *   DEBIT  Cash (1000)                 amount
   *   CREDIT Accounts Receivable (1100)  amount
   */
  async createPayment(dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const tenantId = TenantContext.requireTenantId();

    return this.prisma.$transaction(async (tx) => {
      // 1. Find and validate invoice
      const invoice = await tx.invoice.findFirst({
        where: {
          id: dto.invoiceId,
          tenantId,
        },
      });

      if (!invoice) {
        throw new NotFoundException("Invoice not found for this tenant");
      }

      if (invoice.status === "PAID") {
        throw new BadRequestException("Invoice already paid");
      }

      // Validate payment amount matches invoice amount
      if (Number(dto.amount) !== Number(invoice.amount)) {
        throw new BadRequestException(
          `Payment amount (${dto.amount}) does not match invoice amount (${invoice.amount})`,
        );
      }

      // 2. Create payment
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
        },
      });

      // 3. Mark invoice as PAID
      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: { status: "PAID" },
      });

      // 4. Create accounting journal entry
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
