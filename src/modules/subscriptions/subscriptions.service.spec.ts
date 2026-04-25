import { BadRequestException } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { TenantContext } from "@/common/tenant-context";

describe("SubscriptionsService", () => {
  const makeService = () => {
    const prismaMock = {
      plan: {
        findFirst: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
      },
      subscription: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const service = new SubscriptionsService(prismaMock as never);
    return { service, prismaMock };
  };

  beforeEach(() => {
    jest.spyOn(TenantContext, "requireTenantId").mockReturnValue("tenant-1");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects create when plan is missing or inactive", async () => {
    const { service, prismaMock } = makeService();
    prismaMock.plan.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        customerId: "cust-1",
        planId: "plan-1",
        startDate: "2026-01-01",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects create when customer is missing", async () => {
    const { service, prismaMock } = makeService();
    prismaMock.plan.findFirst.mockResolvedValue({
      id: "plan-1",
      tenantId: "tenant-1",
      isActive: true,
    });
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        customerId: "cust-1",
        planId: "plan-1",
        startDate: "2026-01-01",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cancels a subscription and returns response dto", async () => {
    const { service, prismaMock } = makeService();
    prismaMock.subscription.update.mockResolvedValue({
      id: "sub-1",
      customerId: "cust-1",
      planId: "plan-1",
      status: "CANCELLED",
      startDate: new Date("2026-01-01"),
      nextBillingDate: new Date("2026-02-01"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-10"),
      customer: { name: "Alice" },
      plan: { name: "Bronze" },
    });

    const result = await service.cancel("sub-1");

    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "CANCELLED" },
      include: { customer: true, plan: true },
    });
    expect(result.status).toBe("CANCELLED");
    expect(result.customerName).toBe("Alice");
  });
});

