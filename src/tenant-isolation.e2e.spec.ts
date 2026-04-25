import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { TenantContext } from "./common/tenant-context";

type Role = "ADMIN" | "MEMBER";

interface TenantRecord {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRecord {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

interface AccountRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerRecord {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

class InMemoryPrismaService {
  private readonly tenants: TenantRecord[] = [];
  private readonly users: UserRecord[] = [];
  private readonly accounts: AccountRecord[] = [];
  private readonly customers: CustomerRecord[] = [];

  tenant = {
    create: async ({
      data,
    }: {
      data: { name: string; email: string };
    }): Promise<TenantRecord> => {
      const now = new Date();
      const tenant: TenantRecord = {
        id: randomUUID(),
        name: data.name,
        email: data.email,
        createdAt: now,
        updatedAt: now,
      };
      this.tenants.push(tenant);
      return tenant;
    },
  };

  user = {
    create: async ({
      data,
    }: {
      data: {
        tenantId: string;
        email: string;
        passwordHash: string;
        role: Role;
      };
    }): Promise<UserRecord> => {
      const now = new Date();
      const user: UserRecord = {
        id: randomUUID(),
        tenantId: data.tenantId,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        createdAt: now,
        updatedAt: now,
      };
      this.users.push(user);
      return user;
    },
    findFirst: async ({
      where,
      select,
    }: {
      where: Partial<Pick<UserRecord, "id" | "tenantId" | "email">>;
      select?: { id?: boolean; tenantId?: boolean; role?: boolean };
    }): Promise<UserRecord | { id?: string; tenantId?: string; role?: Role } | null> => {
      const user =
        this.users.find((candidate) => {
          const matchesId = where.id ? candidate.id === where.id : true;
          const matchesTenant = where.tenantId
            ? candidate.tenantId === where.tenantId
            : true;
          const matchesEmail = where.email ? candidate.email === where.email : true;
          return matchesId && matchesTenant && matchesEmail;
        }) ?? null;

      if (!user) {
        return null;
      }

      if (!select) {
        return user;
      }

      return {
        id: select.id ? user.id : undefined,
        tenantId: select.tenantId ? user.tenantId : undefined,
        role: select.role ? user.role : undefined,
      };
    },
  };

  account = {
    createMany: async ({
      data,
    }: {
      data: Array<{
        tenantId: string;
        code: string;
        name: string;
        type: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
      }>;
    }): Promise<{ count: number }> => {
      const now = new Date();
      data.forEach((item) => {
        this.accounts.push({
          id: randomUUID(),
          tenantId: item.tenantId,
          code: item.code,
          name: item.name,
          type: item.type,
          createdAt: now,
          updatedAt: now,
        });
      });
      return { count: data.length };
    },
  };

  customer = {
    create: async ({
      data,
    }: {
      data: { tenantId: string; name: string; email: string };
    }): Promise<CustomerRecord> => {
      const now = new Date();
      const customer: CustomerRecord = {
        id: randomUUID(),
        tenantId: data.tenantId,
        name: data.name,
        email: data.email,
        createdAt: now,
        updatedAt: now,
      };
      this.customers.push(customer);
      return customer;
    },
    findMany: async ({
      skip,
      take,
      orderBy,
    }: {
      skip?: number;
      take?: number;
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<CustomerRecord[]> => {
      const tenantId = TenantContext.getTenantId();
      const scoped = this.customers.filter((customer) =>
        tenantId ? customer.tenantId === tenantId : true,
      );

      const sorted = [...scoped].sort((a, b) => {
        if (!orderBy || orderBy.createdAt === "asc") {
          return a.createdAt.getTime() - b.createdAt.getTime();
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const start = skip ?? 0;
      const end = take ? start + take : undefined;
      return sorted.slice(start, end);
    },
  };

  async $transaction<T>(callback: (tx: InMemoryPrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

describe("Tenant Isolation E2E", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new InMemoryPrismaService())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("isolates customer data between tenant A and tenant B", async () => {
    const tenantA = await request(app.getHttpServer())
      .post("/api/auth/register-tenant")
      .send({
        companyName: "Tenant A Inc",
        adminEmail: "admin-a@example.com",
        adminPassword: "StrongPass123!",
      })
      .expect(201);

    const tokenA = tenantA.body.accessToken as string;

    const tenantB = await request(app.getHttpServer())
      .post("/api/auth/register-tenant")
      .send({
        companyName: "Tenant B Inc",
        adminEmail: "admin-b@example.com",
        adminPassword: "StrongPass123!",
      })
      .expect(201);

    const tokenB = tenantB.body.accessToken as string;

    await request(app.getHttpServer())
      .post("/api/customers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "Alice Tenant A",
        email: "alice@tenant-a.com",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/customers")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        name: "Bob Tenant B",
        email: "bob@tenant-b.com",
      })
      .expect(201);

    const listA = await request(app.getHttpServer())
      .get("/api/customers")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const listB = await request(app.getHttpServer())
      .get("/api/customers")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);

    expect(Array.isArray(listA.body)).toBe(true);
    expect(Array.isArray(listB.body)).toBe(true);
    expect(listA.body).toHaveLength(1);
    expect(listB.body).toHaveLength(1);
    expect(listA.body[0].email).toBe("alice@tenant-a.com");
    expect(listB.body[0].email).toBe("bob@tenant-b.com");
  });
});

