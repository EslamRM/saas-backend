import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryInvoiceDto } from "./dto/query-invoice.dto";
import { InvoiceResponseDto } from "./dto/invoice-response.dto";

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(dto: QueryInvoiceDto): Promise<InvoiceResponseDto[]> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;

    const where: any = {};
    if (dto.status) {
      where.status = dto.status;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      subscriptionId: inv.subscriptionId,
      customerId: inv.customerId,
      tenantId: inv.tenantId,
      customerName: inv.customer.name,
      amount: Number(inv.amount),
      status: inv.status,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      createdAt: inv.createdAt,
    }));
  }
}
