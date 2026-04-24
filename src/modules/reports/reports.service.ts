import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '@/common/tenant-context';
import { BalanceSheetDto } from './dto/balance-sheet.dto';
import { IncomeStatementDto } from './dto/income-statement.dto';

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
          code: { in: ['1000', '1100', '2000'] },
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

    const cash = this.round(balances['1000'] || 0);
    const accountsReceivable = this.round(balances['1100'] || 0);
    const deferredRevenue = this.round(balances['2000'] || 0);

    return {
      asOf: new Date().toISOString().split('T')[0],
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
        'Invalid date format. Use YYYY-MM-DD.',
      );
    }

    const tenantId = TenantContext.requireTenantId();

    // Get revenue journal lines within the period
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          tenantId,
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        account: {
          type: 'REVENUE',
        },
      },
      include: {
        account: {
          select: { code: true, type: true },
        },
      },
    });

    const balances = this.computeBalances(lines);
    const subscriptionRevenue = this.round(balances['4000'] || 0);

    return {
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
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
    lines: Array<{
      account: { code: string; type: string };
      type: string;
      amount: any;
    }>,
  ): Record<string, number> {
    const balances: Record<string, number> = {};

    for (const line of lines) {
      const { code, type: accountType } = line.account;
      if (!balances[code]) {
        balances[code] = 0;
      }

      const amount = Number(line.amount);

      // Apply normal balance rules
      if (accountType === 'ASSET' || accountType === 'EXPENSE') {
        // Normal balance is DEBIT
        balances[code] += line.type === 'DEBIT' ? amount : -amount;
      } else {
        // LIABILITY, REVENUE - Normal balance is CREDIT
        balances[code] += line.type === 'CREDIT' ? amount : -amount;
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