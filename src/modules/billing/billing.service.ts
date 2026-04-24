import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AccountingService } from "../accounting/accounting.service";

/**
 * Billing engine responsible for generating invoices.
 *
 * Processes all tenants' subscriptions that are due for billing.
 * Each subscription's invoice + accounting entry is processed
 * in its own transaction for isolation.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  /**
   * Generates invoices for all active subscriptions due for billing.
   *
   * For each subscription:
   * 1. Create Invoice (PENDING)
   * 2. Create Journal Entry (Debit A/R, Credit Deferred Revenue)
   * 3. Advance nextBillingDate by intervalDays
   *
   * All per-subscription operations are atomic.
   * Failures for individual subscriptions are logged but don't stop processing.
   */
  async generateMonthlyInvoices(): Promise<number> {
    this.logger.log("Starting monthly invoice generation");

    // Get all tenants (not tenant-scoped - this is a system operation)
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    let totalGenerated = 0;

    for (const tenant of tenants) {
      try {
        const count = await this.processTenantBilling(tenant.id, tenant.name);
        totalGenerated += count;
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(
          `Failed to process billing for tenant ${tenant.name} (${tenant.id}): ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(
      `Monthly billing complete: ${totalGenerated} invoices generated`,
    );
    return totalGenerated;
  }

  /**
   * Process billing for a single tenant.
   * Explicitly passes tenantId since we're not in a TenantContext.
   */
  private async processTenantBilling(
    tenantId: string,
    tenantName: string,
  ): Promise<number> {
    // Find subscriptions due for billing
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        nextBillingDate: { lte: new Date() },
      },
      include: {
        plan: true,
        customer: true,
      },
    });

    if (subscriptions.length === 0) {
      return 0;
    }

    this.logger.log(
      `Processing ${subscriptions.length} subscription(s) for tenant ${tenantName}`,
    );

    let count = 0;

    for (const subscription of subscriptions) {
      try {
        await this.processSubscription(subscription, tenantId);
        count++;
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(
          `Failed to process subscription ${subscription.id}: ${err.message}`,
          err.stack,
        );
      }
    }

    return count;
  }

  /**
   * Process a single subscription: create invoice + accounting entry.
   *
   * Journal Entry on Invoice Creation:
   *   DEBIT  Accounts Receivable (1100)  amount
   *   CREDIT Deferred Revenue (2000)     amount
   *
   * This recognizes the obligation to deliver service (liability)
   * and the right to receive payment (asset).
   */
  private async processSubscription(
    subscription: any,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Calculate period end
      const periodEnd = new Date(subscription.nextBillingDate);
      periodEnd.setDate(
        periodEnd.getDate() + subscription.plan.intervalDays - 1,
      );

      // 1. Create invoice
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

      // 2. Create accounting journal entry
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

      // 3. Advance next billing date
      const nextBillingDate = new Date(subscription.nextBillingDate);
      nextBillingDate.setDate(
        nextBillingDate.getDate() + subscription.plan.intervalDays,
      );

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { nextBillingDate },
      });

      this.logger.debug(
        `Created invoice ${invoice.id} for subscription ${subscription.id}, next billing: ${nextBillingDate.toISOString()}`,
      );
    });
  }
}
