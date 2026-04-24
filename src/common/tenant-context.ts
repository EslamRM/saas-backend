import { AsyncLocalStorage } from "async_hooks";

/**
 * Tenant context using AsyncLocalStorage.
 * Provides tenant isolation across async boundaries without
 * explicitly passing tenantId through every function call.
 *
 * Usage:
 * - TenantInterceptor sets context from JWT
 * - PrismaService middleware reads context for auto-injection
 */
interface TenantContextData {
  tenantId: string;
}

export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantContextData>();

  /**
   * Run a callback within a tenant context.
   * All async operations within will have access to the tenantId.
   */
  static run<T>(tenantId: string, callback: () => T): T {
    return this.storage.run({ tenantId }, callback);
  }

  /**
   * Get the current tenant ID from the async context.
   * Returns undefined if not within a tenant context.
   */
  static getTenantId(): string | undefined {
    const store = this.storage.getStore();
    return store?.tenantId;
  }

  /**
   * Get the current tenant ID or throw if not in context.
   */
  static requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error("Tenant context not available");
    }
    return tenantId;
  }
}
