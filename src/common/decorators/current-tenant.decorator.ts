import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extracts tenantId from JWT payload.
 * Requires JwtAuthGuard to have run first.
 *
 * Usage: @CurrentTenant() tenantId: string
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      throw new Error(
        "CurrentTenant decorator used without authenticated user context",
      );
    }

    return tenantId;
  },
);
