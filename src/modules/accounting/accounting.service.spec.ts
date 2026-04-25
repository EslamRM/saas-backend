import { BadRequestException } from "@nestjs/common";
import { AccountingService } from "./accounting.service";

describe("AccountingService", () => {
  const makeService = () => {
    const prismaMock = {
      account: {
        findMany: jest.fn(),
      },
      journalEntry: {
        create: jest.fn(),
      },
      invoice: {
        findMany: jest.fn(),
      },
    };

    const service = new AccountingService(prismaMock as never);
    return { service, prismaMock };
  };

  it("creates a balanced journal entry", async () => {
    const { service, prismaMock } = makeService();

    prismaMock.account.findMany.mockResolvedValue([
      { id: "acc-ar", code: "1100" },
      { id: "acc-def", code: "2000" },
    ]);

    prismaMock.journalEntry.create.mockResolvedValue({
      id: "je-1",
      description: "Invoice entry",
      lines: [],
    });

    const result = await service.createJournalEntry({
      tenantId: "tenant-1",
      description: "Invoice entry",
      lines: [
        { accountCode: "1100", type: "DEBIT", amount: 100 },
        { accountCode: "2000", type: "CREDIT", amount: 100 },
      ],
    });

    expect(result.id).toBe("je-1");
    expect(prismaMock.account.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it("throws when entry is not balanced", async () => {
    const { service, prismaMock } = makeService();

    prismaMock.account.findMany.mockResolvedValue([
      { id: "acc-ar", code: "1100" },
      { id: "acc-def", code: "2000" },
    ]);

    await expect(
      service.createJournalEntry({
        tenantId: "tenant-1",
        description: "Broken entry",
        lines: [
          { accountCode: "1100", type: "DEBIT", amount: 120 },
          { accountCode: "2000", type: "CREDIT", amount: 100 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled();
  });

  it("throws when account codes are missing", async () => {
    const { service, prismaMock } = makeService();

    prismaMock.account.findMany.mockResolvedValue([{ id: "acc-ar", code: "1100" }]);

    await expect(
      service.createJournalEntry({
        tenantId: "tenant-1",
        description: "Missing account",
        lines: [
          { accountCode: "1100", type: "DEBIT", amount: 100 },
          { accountCode: "2000", type: "CREDIT", amount: 100 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

