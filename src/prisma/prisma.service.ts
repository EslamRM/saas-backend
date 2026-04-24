import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContext } from "@/common/tenant-context";

/**
 * Extended Prisma client with automatic tenant isolation middleware.
 *
 * Models with tenant_id have WHERE clauses automatically injected
 * by Prisma middleware reading from TenantContext (AsyncLocalStorage).
 *
 * This ensures tenant isolation at the data access layer without
 * requiring manual filtering in every service method.
 */
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

    this.setupTenantMiddleware();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Configures Prisma middleware for automatic tenant isolation.
   *
   * For all tenant-scoped models:
   * - READ operations: inject tenantId into WHERE clause
   * - CREATE operations: inject tenantId into data
   * - UPDATE/DELETE operations: inject tenantId into WHERE clause
   *
   * Does NOT apply when TenantContext has no tenantId (e.g., system operations).
   */
  private setupTenantMiddleware(): void {
    const tenantScopedModels: string[] = [
      "user",
      "customer",
      "plan",
      "subscription",
      "invoice",
      "payment",
      "account",
      "journalEntry",
      // Note: journalLine is NOT here - accessed via journalEntry (no direct tenantId)
    ];

    this.$use(async (params: any, next: (params: any) => Promise<any>) => {
      const tenantId = TenantContext.getTenantId();

      // Skip if no tenant context or model is not tenant-scoped
      if (!tenantId || !tenantScopedModels.includes(params.model)) {
        return next(params);
      }

      // Clone args to avoid mutation issues
      const args = { ...params.args };

      switch (params.action) {
        case "findUnique":
        case "findFirst":
          args.where = { ...(args.where || {}), tenantId };
          break;

        case "findMany":
        case "count":
          args.where = args.where ? { ...args.where, tenantId } : { tenantId };
          break;

        case "create":
          args.data = { ...(args.data || {}), tenantId };
          break;

        case "update":
          args.where = { ...(args.where || {}), tenantId };
          break;

        case "updateMany":
          args.where = args.where ? { ...args.where, tenantId } : { tenantId };
          break;

        case "delete":
          args.where = { ...(args.where || {}), tenantId };
          break;

        case "deleteMany":
          args.where = args.where ? { ...args.where, tenantId } : { tenantId };
          break;

        case "upsert":
          args.where = { ...(args.where || {}), tenantId };
          args.create = { ...(args.create || {}), tenantId };
          break;
      }

      return next({ ...params, args });
    });
  }

  /**
   * Execute operations within a transaction.
   * Tenant middleware is preserved within the transaction.
   */
  async executeInTransaction<T>(
    fn: (prisma: PrismaService) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn as (tx: unknown) => Promise<T>);
  }
}
