import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { TenantContext } from "../common/tenant-context";

const tenantScopedModels = [
  "user",
  "customer",
  "plan",
  "subscription",
  "invoice",
  "payment",
  "account",
  "journalEntry",
];

// FIXED: Proper mapping to ensure 'where' is ALWAYS injected for reads
const generateModelExtension = () => ({
  async $allOperations({ args, query, operation }: any) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) return query(args);

    // Safely build the where clause (always include tenantId for reads)
    const safeWhere = args.where ? { ...args.where, tenantId } : { tenantId };

    // Safely build the data clause
    let safeData = args.data;
    if (args.data) {
      safeData = Array.isArray(args.data)
        ? args.data.map((d: any) => ({ ...d, tenantId }))
        : { ...args.data, tenantId };
    }

    switch (operation) {
      case "findUnique":
      case "findFirst":
      case "findMany":
      case "count":
      case "aggregate":
      case "groupBy":
        return query({ ...args, where: safeWhere });
      case "create":
        return query({ ...args, data: safeData });
      case "update":
      case "delete":
        return query({ ...args, where: safeWhere });
      case "updateMany":
      case "deleteMany":
        return query({ ...args, where: safeWhere });
      case "upsert":
        return query({
          ...args,
          where: safeWhere,
          create: safeData,
          update: args.update,
        });
      default:
        return query(args);
    }
  },
});

const tenantQueryExtensions: any = {};
tenantScopedModels.forEach((model) => {
  tenantQueryExtensions[model] = generateModelExtension();
});

const tenantExtension = Prisma.defineExtension({
  name: "tenantIsolation",
  query: tenantQueryExtensions,
});

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
    return this.$extends(tenantExtension) as any;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
