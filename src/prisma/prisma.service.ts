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

type ArgsRecord = Record<string, unknown>;

const readOperations = new Set<Prisma.PrismaAction>([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const whereOnlyOperations = new Set<Prisma.PrismaAction>([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const dataOnlyOperations = new Set<Prisma.PrismaAction>([
  "create",
  "createMany",
]);

const whereAndDataOperations = new Set<Prisma.PrismaAction>(["upsert"]);

const isObject = (value: unknown): value is ArgsRecord =>
  typeof value === "object" && value !== null;

const withTenantWhere = (args: ArgsRecord, tenantId: string): ArgsRecord => {
  const currentWhere = isObject(args.where) ? args.where : {};
  return { ...args, where: { ...currentWhere, tenantId } };
};

const withTenantData = (args: ArgsRecord, tenantId: string): ArgsRecord => {
  const data = args.data;

  if (!data) {
    return args;
  }

  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((item) =>
        isObject(item) ? { ...item, tenantId } : item,
      ),
    };
  }

  if (isObject(data)) {
    return { ...args, data: { ...data, tenantId } };
  }

  return args;
};

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

    this.$use(
      async (
        params: Prisma.MiddlewareParams,
        next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
      ): Promise<unknown> => {
        const tenantId = TenantContext.getTenantId();

        if (!tenantId || !tenantScopedModels.includes(params.model ?? "")) {
          return next(params);
        }

        const rawArgs = (params.args ?? {}) as ArgsRecord;
        let nextArgs = rawArgs;

        if (readOperations.has(params.action)) {
          nextArgs = withTenantWhere(nextArgs, tenantId);
        } else if (whereOnlyOperations.has(params.action)) {
          nextArgs = withTenantWhere(nextArgs, tenantId);
        } else if (dataOnlyOperations.has(params.action)) {
          nextArgs = withTenantData(nextArgs, tenantId);
        } else if (whereAndDataOperations.has(params.action)) {
          const withWhere = withTenantWhere(nextArgs, tenantId);
          const create = isObject(withWhere.create)
            ? { ...withWhere.create, tenantId }
            : withWhere.create;
          const update = isObject(withWhere.update)
            ? { ...withWhere.update, tenantId }
            : withWhere.update;
          nextArgs = { ...withWhere, create, update };
        }

        params.args = nextArgs;
        return next(params);
      },
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
