import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { TenantContext } from "../../common/tenant-context";

describe("PaymentsService", () => {
  const makeService = () => {
    const tx = {
      invoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
    };

    const prismaMock = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };

    const accountingServiceMock = {
      createJournalEntry: jest.fn(),
    };

    const service = new PaymentsService(
      prismaMock as never,
      accountingServiceMock as never,
    );

    return { service, prismaMock, tx, accountingServiceMock };
  };

  beforeEach(() => {
    jest.spyOn(TenantContext, "requireTenantId").mockReturnValue("tenant-1");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws NotFoundException when invoice does not exist", async () => {
    const { service, tx } = makeService();
    tx.invoice.findFirst.mockResolvedValue(null);

    await expect(
      service.createPayment({ invoiceId: "inv-1", amount: 100 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws BadRequestException when payment amount does not match invoice", async () => {
    const { service, tx } = makeService();
    tx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      amount: "100.00",
      status: "PENDING",
    });

    await expect(
      service.createPayment({ invoiceId: "inv-1", amount: 99 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates payment, marks invoice paid, and writes accounting entry", async () => {
    const { service, tx, accountingServiceMock } = makeService();

    tx.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      amount: "100.00",
      status: "PENDING",
    });
    tx.payment.create.mockResolvedValue({
      id: "pay-1",
      invoiceId: "inv-1",
      amount: 100,
      paidAt: new Date("2026-01-01"),
      createdAt: new Date("2026-01-01"),
    });
    tx.invoice.update.mockResolvedValue({
      id: "inv-1",
      status: "PAID",
    });
    accountingServiceMock.createJournalEntry.mockResolvedValue({
      id: "je-pay-1",
    });

    const result = await service.createPayment({ invoiceId: "inv-1", amount: 100 });

    expect(result.id).toBe("pay-1");
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "PAID" },
    });
    expect(accountingServiceMock.createJournalEntry).toHaveBeenCalledTimes(1);
  });
});

