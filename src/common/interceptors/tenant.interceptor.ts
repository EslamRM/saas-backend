import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Reflector } from "@nestjs/core";
import { TenantContext } from "../tenant-context";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Wraps request handling in TenantContext using AsyncLocalStorage.
 * This enables Prisma middleware to automatically inject tenantId
 * into all database queries without explicit filtering.
 *
 * Must run after JwtAuthGuard to access user.tenantId.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { tenantId } = request.user || {};

    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      TenantContext.run(tenantId, () => {
        return next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
