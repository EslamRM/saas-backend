import { Injectable } from "@nestjs/common";
import { Prisma, InvoiceStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryInvoiceDto } from "./dto/query-invoice.dto";
import { InvoiceResponseDto } from "./dto/invoice-response.dto";

type InvoiceWithCustomerName = Prisma.InvoiceGetPayload<{
  include: { customer: { select: { name: true } } };
}>;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: QueryInvoiceDto): Promise<InvoiceResponseDto[]> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const where: Prisma.InvoiceWhereInput = {};
    if (dto.status) {
      where.status = dto.status as InvoiceStatus;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map(InvoicesService.toResponseDto);
  }

  private static toResponseDto(inv: InvoiceWithCustomerName): InvoiceResponseDto {
    return {
      id: inv.id,
      subscriptionId: inv.subscriptionId,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      amount: Number(inv.amount),
      status: inv.status,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      createdAt: inv.createdAt,
    };
  }
}
