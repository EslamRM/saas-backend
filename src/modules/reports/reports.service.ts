import { Injectable, BadRequestException } from "@nestjs/common";
import { Prisma, AccountType, JournalLineType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "@/common/tenant-context";
import { BalanceSheetDto } from "./dto/balance-sheet.dto";
import { IncomeStatementDto } from "./dto/income-statement.dto";

/**
 * Financial reporting service.
 *
 * CRITICAL: All balances are computed from journal lines.
 * No balance columns are stored on accounts.
 *
 * Balance computation rules (normal balance by account type):
 * - ASSET accounts:     balance = sum(DEBITs) - sum(CREDITs)
 * - LIABILITY accounts: balance = sum(CREDITs) - sum(DEBITs)
 * - REVENUE accounts:   balance = sum(CREDITs) - sum(DEBITs)
 * - EXPENSE accounts:   balance = sum(DEBITs) - sum(CREDITs)
 */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private static readonly BALANCE_SHEET_CODES = ["1000", "1100", "2000"];
  private static readonly SUBSCRIPTION_REVENUE_CODE = "4000";

  /**
   * Generates balance sheet showing assets and liabilities.
   *
   * Assets:
   *   - Cash (1000)
   *   - Accounts Receivable (1100)
   *
   * Liabilities:
   *   - Deferred Revenue (2000)
   */
  async getBalanceSheet(): Promise<BalanceSheetDto> {
    const tenantId = TenantContext.requireTenantId();

    // Get all journal lines for balance sheet accounts
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: { tenantId },
        account: {
          code: { in: ReportsService.BALANCE_SHEET_CODES },
        },
      },
      include: {
        account: {
          select: { code: true, type: true },
        },
      },
    });

    // Compute balances by account code
    const balances = this.computeBalances(lines);

    const cash = this.round(balances["1000"] ?? 0);
    const accountsReceivable = this.round(balances["1100"] ?? 0);
    const deferredRevenue = this.round(balances["2000"] ?? 0);

    return {
      asOf: new Date().toISOString().split("T")[0],
      assets: {
        cash,
        accountsReceivable,
        totalAssets: this.round(cash + accountsReceivable),
      },
      liabilities: {
        deferredRevenue,
        totalLiabilities: deferredRevenue,
      },
    };
  }

  /**
   * Generates income statement for a period.
   *
   * Revenue:
   *   - Subscription Revenue (4000)
   */
  async getIncomeStatement(
    from: Date,
    to: Date,
  ): Promise<IncomeStatementDto> {
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException(
        "Invalid date format. Use YYYY-MM-DD.",
      );
    }
    if (from > to) {
      throw new BadRequestException("'from' date must be before or equal to 'to'.");
    }

    const tenantId = TenantContext.requireTenantId();

    // Use invoice periodEnd (not journal createdAt) as the accounting period anchor.
    const invoicesInPeriod = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        periodEnd: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        periodEnd: true,
      },
    });

    if (invoicesInPeriod.length === 0) {
      return {
        period: {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        },
        revenue: {
          subscriptionRevenue: 0,
        },
        totalRevenue: 0,
      };
    }

    const invoicesById = new Map<string, { id: string; periodEnd: Date }>(
      invoicesInPeriod.map((invoice) => [invoice.id, invoice]),
    );
    const invoiceIds = invoicesInPeriod.map((invoice) => invoice.id);

    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        referenceType: "REVENUE_RECOGNITION",
        referenceId: {
          in: invoiceIds,
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                code: true,
                type: true,
              },
            },
          },
        },
      },
    });

    const lines: ComputedBalanceLine[] = journalEntries.flatMap((entry) => {
      const referenceId = entry.referenceId;
      if (!referenceId) {
        return [];
      }
      const invoice = invoicesById.get(referenceId);
      if (!invoice) {
        return [];
      }

      return entry.lines.map((line) => ({
        account: {
          code: line.account.code,
          type: line.account.type,
        },
        type: line.type,
        amount: line.amount,
      }));
    });

    const balances = this.computeBalances(lines);
    const subscriptionRevenue = this.round(
      balances[ReportsService.SUBSCRIPTION_REVENUE_CODE] ?? 0,
    );

    return {
      period: {
        from: from.toISOString().split("T")[0],
        to: to.toISOString().split("T")[0],
      },
      revenue: {
        subscriptionRevenue,
      },
      totalRevenue: subscriptionRevenue,
    };
  }

  /**
   * Computes balances for a set of journal lines.
   * Applies normal balance rules based on account type.
   */
  private computeBalances(
    lines: ComputedBalanceLine[],
  ): Record<string, number> {
    const balances: Record<string, number> = {};

    for (const line of lines) {
      const { code, type: accountType } = line.account;
      if (!(code in balances)) {
        balances[code] = 0;
      }

      const amount = Number(line.amount);

      // Apply normal balance rules
      if (accountType === "ASSET" || accountType === "EXPENSE") {
        // Normal balance is DEBIT
        balances[code] += line.type === "DEBIT" ? amount : -amount;
      } else {
        // LIABILITY, REVENUE - Normal balance is CREDIT
        balances[code] += line.type === "CREDIT" ? amount : -amount;
      }
    }

    return balances;
  }

  /**
   * Rounds to 2 decimal places and avoids floating point issues.
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

interface ComputedBalanceLine {
  account: {
    code: string;
    type: AccountType;
  };
  type: JournalLineType;
  amount: Prisma.Decimal;
}