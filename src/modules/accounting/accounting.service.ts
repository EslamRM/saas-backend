import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '@/common/tenant-context';

/**
 * Journal line data for creating entries.
 */
export interface JournalLineInput {
  accountCode: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

/**
 * Data for creating a journal entry.
 */
export interface CreateJournalEntryData {
  tenantId: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  lines: JournalLineInput[];
}

/**
 * Transaction client type matching Prisma's transaction callback parameter.
 */
type TransactionClient = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Accounting service implementing double-entry bookkeeping.
 *
 * Core principles:
 * - NEVER mutate account balances directly
 * - All financial state is derived from journal lines
 * - Every journal entry must balance (debits = credits)
 * - Account types determine normal balance side
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Creates a journal entry with all its lines in a single transaction.
   *
   * Validates:
   * 1. All account codes exist for the tenant
   * 2. Sum of DEBITs equals sum of CREDITs (must balance)
   *
   * @param data - Journal entry data with lines
   * @param tx - Optional transaction client for use within existing transactions
   */
  async createJournalEntry(
    data: CreateJournalEntryData,
    tx?: TransactionClient,
  ): Promise<any> {
    const client = tx || this.prisma;

    // 1. Resolve account IDs from codes
    const accountCodes = [...new Set(data.lines.map((l) => l.accountCode))];
    const accounts = await client.account.findMany({
      where: {
        code: { in: accountCodes },
        tenantId: data.tenantId,
      },
    });

    // Validate all accounts were found
    const foundCodes = new Set(accounts.map((a) => a.code));
    const missingCodes = accountCodes.filter((code) => !foundCodes.has(code));

    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `Account codes not found: ${missingCodes.join(', ')}`,
      );
    }

    // 2. Validate entry balances
    this.validateBalancedEntry(data.lines);

    // 3. Create journal entry with lines
    const journalEntry = await client.journalEntry.create({
      data: {
        tenantId: data.tenantId,
        description: data.description,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        lines: {
          create: data.lines.map((line) => ({
            accountId: accounts.find((a) => a.code === line.accountCode)!.id,
            type: line.type,
            amount: line.amount,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    this.logger.debug(
      `Created journal entry ${journalEntry.id}: ${data.description}`,
    );

    return journalEntry;
  }

  /**
   * Recognizes revenue for PAID invoices in a given month.
   *
   * Simulates month-end accounting close process.
   *
   * For each PAID invoice where periodEnd falls within the month
   * and hasn't been recognized yet:
   *
   *   DEBIT  Deferred Revenue (2000)      amount
   *   CREDIT Subscription Revenue (4000)  amount
   *
   * This moves the liability (deferred revenue) to earned revenue.
   *
   * @param month - Month string in YYYY-MM format (defaults to previous month)
   */
  async recognizeRevenue(month?: string): Promise<number> {
    const tenantId = TenantContext.requireTenantId();

    // Parse month, default to previous month
    const targetMonth = month || this.getPreviousMonth();
    const { start, end } = this.getMonthBounds(targetMonth);

    // Find PAID invoices in the period
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: 'PAID',
        periodEnd: {
          gte: start,
          lte: end,
        },
      },
    });

    if (invoices.length === 0) {
      return 0;
    }

    let recognized = 0;

    for (const invoice of invoices) {
      // Check if already recognized for this invoice
      const existingRecognition = await this.prisma.journalEntry.findFirst({
        where: {
          tenantId,
          referenceType: 'REVENUE_RECOGNITION',
          referenceId: invoice.id,
        },
      });

      if (existingRecognition) {
        continue; // Already recognized
      }

      // Create recognition entry
      await this.createJournalEntry({
        tenantId,
        description: `Revenue recognition for invoice ${invoice.id} (${targetMonth})`,
        referenceType: 'REVENUE_RECOGNITION',
        referenceId: invoice.id,
        lines: [
          {
            accountCode: '2000',
            type: 'DEBIT',
            amount: Number(invoice.amount),
          },
          {
            accountCode: '4000',
            type: 'CREDIT',
            amount: Number(invoice.amount),
          },
        ],
      });

      recognized++;
    }

    this.logger.log(
      `Recognized revenue for ${recognized} invoice(s) in ${targetMonth}`,
    );

    return recognized;
  }

  /**
   * Validates that a set of journal lines balances.
   * Throws BadRequestException if debits != credits.
   */
  private validateBalancedEntry(lines: JournalLineInput[]): void {
    const totalDebits = lines
      .filter((l) => l.type === 'DEBIT')
      .reduce((sum, l) => sum + l.amount, 0);

    const totalCredits = lines
      .filter((l) => l.type === 'CREDIT')
      .reduce((sum, l) => sum + l.amount, 0);

    // Use small epsilon for floating point comparison
    const epsilon = 0.001;
    if (Math.abs(totalDebits - totalCredits) > epsilon) {
      throw new BadRequestException(
        `Journal entry must balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`,
      );
    }
  }

  /**
   * Gets previous month in YYYY-MM format.
   */
  private getPreviousMonth(): string {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Parses YYYY-MM format and returns start/end dates.
   */
  private getMonthBounds(month: string): { start: Date; end: Date } {
    const [year, monthNum] = month.split('-').map(Number);

    const start = new Date(year, monthNum - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, monthNum, 0, 23, 59, 59, 999); // Last day of month

    return { start, end };
  }
}