import { AccountingService } from "./modules/accounting/accounting.service";
import { ReportsService } from "./modules/reports/reports.service";
import { TenantContext } from "./common/tenant-context";

type AccountType = "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
type JournalLineType = "DEBIT" | "CREDIT";

interface AccountRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
}

interface InvoiceRecord {
  id: string;
  tenantId: string;
  amount: number;
  status: "PENDING" | "PAID";
  periodStart: Date;
  periodEnd: Date;
}

interface JournalLineRecord {
  id: string;
  journalEntryId: string;
  accountId: string;
  type: JournalLineType;
  amount: number;
}

interface JournalEntryRecord {
  id: string;
  tenantId: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: Date;
}

class InMemoryFinancialPrisma {
  private idCounter = 1;
  readonly accounts: AccountRecord[] = [];
  readonly invoices: InvoiceRecord[] = [];
  readonly journalEntries: JournalEntryRecord[] = [];
  readonly journalLines: JournalLineRecord[] = [];

  private nextId(prefix: string): string {
    const id = `${prefix}-${this.idCounter}`;
    this.idCounter += 1;
    return id;
  }

  account = {
    findMany: async ({
      where,
    }: {
      where: { code?: { in: string[] }; tenantId: string };
    }): Promise<AccountRecord[]> => {
      return this.accounts.filter((account) => {
        const tenantMatch = account.tenantId === where.tenantId;
        const codeMatch = where.code?.in
          ? where.code.in.includes(account.code)
          : true;
        return tenantMatch && codeMatch;
      });
    },
  };

  invoice = {
    findMany: async ({
      where,
      select,
    }: {
      where: {
        tenantId: string;
        status?: "PENDING" | "PAID";
        periodEnd?: { gte: Date; lte: Date };
      };
      select?: { id?: boolean; periodEnd?: boolean };
    }): Promise<Array<InvoiceRecord | { id: string; periodEnd: Date }>> => {
      const filtered = this.invoices.filter((invoice) => {
        const tenantMatch = invoice.tenantId === where.tenantId;
        const statusMatch = where.status ? invoice.status === where.status : true;
        const periodMatch = where.periodEnd
          ? invoice.periodEnd >= where.periodEnd.gte &&
            invoice.periodEnd <= where.periodEnd.lte
          : true;
        return tenantMatch && statusMatch && periodMatch;
      });

      if (!select) {
        return filtered;
      }

      return filtered.map((invoice) => ({
        id: select.id ? invoice.id : invoice.id,
        periodEnd: select.periodEnd ? invoice.periodEnd : invoice.periodEnd,
      }));
    },
  };

  journalEntry = {
    findFirst: async ({
      where,
    }: {
      where: { tenantId: string; referenceType: string; referenceId: string };
    }): Promise<JournalEntryRecord | null> => {
      return (
        this.journalEntries.find(
          (entry) =>
            entry.tenantId === where.tenantId &&
            entry.referenceType === where.referenceType &&
            entry.referenceId === where.referenceId,
        ) ?? null
      );
    },
    findMany: async ({
      where,
      include,
    }: {
      where: {
        tenantId: string;
        referenceType?: string;
        referenceId?: { in: string[] };
      };
      include?: {
        lines?: {
          include?: {
            account?: { select: { code: boolean; type: boolean } };
          };
        };
      };
    }): Promise<
      Array<
        JournalEntryRecord & {
          lines: Array<{
            type: JournalLineType;
            amount: number;
            account: { code: string; type: AccountType };
          }>;
        }
      >
    > => {
      const entries = this.journalEntries.filter((entry) => {
        const tenantMatch = entry.tenantId === where.tenantId;
        const typeMatch = where.referenceType
          ? entry.referenceType === where.referenceType
          : true;
        const idMatch = where.referenceId?.in
          ? where.referenceId.in.includes(entry.referenceId ?? "")
          : true;
        return tenantMatch && typeMatch && idMatch;
      });

      if (!include?.lines?.include?.account) {
        return entries.map((entry) => ({ ...entry, lines: [] }));
      }

      return entries.map((entry) => {
        const lines = this.journalLines
          .filter((line) => line.journalEntryId === entry.id)
          .map((line) => {
            const account = this.accounts.find((acc) => acc.id === line.accountId);
            if (!account) {
              throw new Error("Account not found for journal line");
            }
            return {
              type: line.type,
              amount: line.amount,
              account: { code: account.code, type: account.type },
            };
          });

        return { ...entry, lines };
      });
    },
    create: async ({
      data,
      include,
    }: {
      data: {
        tenantId: string;
        description: string;
        referenceType?: string;
        referenceId?: string;
        lines: {
          create: Array<{
            accountId: string;
            type: JournalLineType;
            amount: number;
          }>;
        };
      };
      include?: {
        lines?: {
          include?: { account?: boolean };
        };
      };
    }): Promise<{
      id: string;
      tenantId: string;
      description: string;
      referenceType?: string;
      referenceId?: string;
      lines: Array<{
        type: JournalLineType;
        amount: number;
        account: AccountRecord;
      }>;
    }> => {
      const entryId = this.nextId("je");
      const entry: JournalEntryRecord = {
        id: entryId,
        tenantId: data.tenantId,
        description: data.description,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        createdAt: new Date(),
      };
      this.journalEntries.push(entry);

      const createdLines = data.lines.create.map((line) => {
        const lineRecord: JournalLineRecord = {
          id: this.nextId("jl"),
          journalEntryId: entryId,
          accountId: line.accountId,
          type: line.type,
          amount: line.amount,
        };
        this.journalLines.push(lineRecord);

        const account = this.accounts.find((acc) => acc.id === line.accountId);
        if (!account) {
          throw new Error("Account not found while creating journal line");
        }

        return {
          type: line.type,
          amount: line.amount,
          account,
        };
      });

      if (!include?.lines?.include?.account) {
        return { ...entry, lines: [] };
      }

      return { ...entry, lines: createdLines };
    },
  };

  journalLine = {
    findMany: async ({
      where,
      include,
    }: {
      where: {
        journalEntry?: { tenantId?: string; createdAt?: { gte: Date; lte: Date } };
        account?: { code?: { in: string[] }; type?: AccountType };
      };
      include?: { account?: { select: { code: boolean; type: boolean } } };
    }): Promise<
      Array<{
        type: JournalLineType;
        amount: number;
        account: { code: string; type: AccountType };
      }>
    > => {
      if (!include?.account) {
        return [];
      }

      return this.journalLines
        .filter((line) => {
          const entry = this.journalEntries.find(
            (journalEntry) => journalEntry.id === line.journalEntryId,
          );
          const account = this.accounts.find((acc) => acc.id === line.accountId);
          if (!entry || !account) {
            return false;
          }

          const tenantMatch = where.journalEntry?.tenantId
            ? entry.tenantId === where.journalEntry.tenantId
            : true;

          const dateMatch = where.journalEntry?.createdAt
            ? entry.createdAt >= where.journalEntry.createdAt.gte &&
              entry.createdAt <= where.journalEntry.createdAt.lte
            : true;

          const codeMatch = where.account?.code?.in
            ? where.account.code.in.includes(account.code)
            : true;

          const typeMatch = where.account?.type
            ? account.type === where.account.type
            : true;

          return tenantMatch && dateMatch && codeMatch && typeMatch;
        })
        .map((line) => {
          const account = this.accounts.find((acc) => acc.id === line.accountId);
          if (!account) {
            throw new Error("Account not found for line query");
          }
          return {
            type: line.type,
            amount: line.amount,
            account: { code: account.code, type: account.type },
          };
        });
    },
  };
}

describe("Financial Flow Integration", () => {
  it("keeps reports consistent through invoice, payment, and recognition", async () => {
    const prisma = new InMemoryFinancialPrisma();
    const accountingService = new AccountingService(prisma as never);
    const reportsService = new ReportsService(prisma as never);
    const tenantId = "tenant-fin-1";

    prisma.accounts.push(
      { id: "acc-1000", tenantId, code: "1000", name: "Cash", type: "ASSET" },
      {
        id: "acc-1100",
        tenantId,
        code: "1100",
        name: "Accounts Receivable",
        type: "ASSET",
      },
      {
        id: "acc-2000",
        tenantId,
        code: "2000",
        name: "Deferred Revenue",
        type: "LIABILITY",
      },
      {
        id: "acc-4000",
        tenantId,
        code: "4000",
        name: "Subscription Revenue",
        type: "REVENUE",
      },
    );

    prisma.invoices.push({
      id: "inv-100",
      tenantId,
      amount: 100,
      status: "PAID",
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-15T12:00:00.000Z"),
    });

    await TenantContext.run(tenantId, async () => {
      await accountingService.createJournalEntry({
        tenantId,
        description: "Invoice inv-100",
        referenceType: "INVOICE",
        referenceId: "inv-100",
        lines: [
          { accountCode: "1100", type: "DEBIT", amount: 100 },
          { accountCode: "2000", type: "CREDIT", amount: 100 },
        ],
      });

      await accountingService.createJournalEntry({
        tenantId,
        description: "Payment inv-100",
        referenceType: "PAYMENT",
        referenceId: "pay-100",
        lines: [
          { accountCode: "1000", type: "DEBIT", amount: 100 },
          { accountCode: "1100", type: "CREDIT", amount: 100 },
        ],
      });

      const recognized = await accountingService.recognizeRevenue("2026-01");
      expect(recognized).toBe(1);

      const balanceSheet = await reportsService.getBalanceSheet();
      expect(balanceSheet.assets.cash).toBe(100);
      expect(balanceSheet.assets.accountsReceivable).toBe(0);
      expect(balanceSheet.liabilities.deferredRevenue).toBe(0);

      const incomeStatement = await reportsService.getIncomeStatement(
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-31T23:59:59.000Z"),
      );

      expect(incomeStatement.totalRevenue).toBe(100);
      expect(incomeStatement.revenue.subscriptionRevenue).toBe(100);
    });
  });
});

