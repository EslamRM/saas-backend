import { SetMetadata } from "@nestjs/common";

/**
 * Marks an endpoint as public (bypasses JWT authentication).
 * Must be used before @UseGuards(JwtAuthGuard) or on the controller.
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
