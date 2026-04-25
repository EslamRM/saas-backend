import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client"; // FIX: Imported for strict typing
import { PrismaService } from "../../prisma/prisma.service";
import { AccountingService } from "../accounting/accounting.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  async generateMonthlyInvoices(): Promise<number> {
    this.logger.log("Starting monthly invoice generation");
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
    });
    let totalGenerated = 0;

    for (const tenant of tenants) {
      try {
        const count = await this.processTenantBilling(tenant.id, tenant.name);
        totalGenerated += count;
      } catch (error) {
        this.logger.error(
          `Failed to process billing for tenant ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Monthly billing complete: ${totalGenerated} invoices generated`,
    );
    return totalGenerated;
  }

  private async processTenantBilling(
    tenantId: string,
    tenantName: string,
  ): Promise<number> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        nextBillingDate: { lte: new Date() },
      },
      include: { plan: true, customer: true },
    });

    if (subscriptions.length === 0) return 0;
    this.logger.log(
      `Processing ${subscriptions.length} subscription(s) for tenant ${tenantName}`,
    );

    let count = 0;
    for (const subscription of subscriptions) {
      try {
        await this.processSubscription(subscription, tenantId);
        count++;
      } catch (error) {
        // FIX: Strict TypeScript check for Prisma Unique Constraint error
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          this.logger.warn(
            `Duplicate invoice for subscription ${subscription.id}, skipping safely.`,
          );
          continue;
        }
        this.logger.error(
          `Failed to process subscription ${subscription.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return count;
  }

  private async processSubscription(
    subscription: any,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const periodEnd = new Date(subscription.nextBillingDate);
      periodEnd.setDate(
        periodEnd.getDate() + subscription.plan.intervalDays - 1,
      );

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          amount: subscription.plan.price,
          status: "PENDING",
          periodStart: subscription.nextBillingDate,
          periodEnd,
        },
      });

      await this.accountingService.createJournalEntry(
        {
          tenantId,
          description: `Invoice ${invoice.id} created for ${subscription.customer.name} - ${subscription.plan.name}`,
          referenceType: "INVOICE",
          referenceId: invoice.id,
          lines: [
            {
              accountCode: "1100",
              type: "DEBIT",
              amount: Number(subscription.plan.price),
            },
            {
              accountCode: "2000",
              type: "CREDIT",
              amount: Number(subscription.plan.price),
            },
          ],
        },
        tx as any,
      );

      const nextBillingDate = new Date(subscription.nextBillingDate);
      nextBillingDate.setDate(
        nextBillingDate.getDate() + subscription.plan.intervalDays,
      );

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { nextBillingDate },
      });
    });
  }
}
