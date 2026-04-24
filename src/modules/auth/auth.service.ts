import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "./jwt.strategy";
import { RegisterTenantDto } from "./dto/register-tenant.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { TenantContext } from "@/common/tenant-context";

/**
 * Default Chart of Accounts created for every new tenant.
 * Follows standard accounting principles for SaaS businesses.
 */
const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "ASSET" as const },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" as const },
  { code: "2000", name: "Deferred Revenue", type: "LIABILITY" as const },
  { code: "4000", name: "Subscription Revenue", type: "REVENUE" as const },
];

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Registers a new tenant with admin user and default chart of accounts.
   * All operations run in a single transaction for atomicity.
   */
  async registerTenant(dto: RegisterTenantDto): Promise<AuthResponseDto> {
    // Hash password outside transaction (CPU-intensive)
    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name: dto.companyName,
            email: dto.adminEmail,
          },
        });

        // 2. Create admin user linked to tenant
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.adminEmail,
            passwordHash,
            role: "ADMIN",
          },
        });

        // 3. Create default chart of accounts
        await tx.account.createMany({
          data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
            tenantId: tenant.id,
            ...account,
          })),
        });

        return { tenant, user };
      });
    } catch (error: unknown) {
      const prismaError = error as { code?: string; meta?: { target?: string[] } };
      if (prismaError.code === "P2002") {
        const target = prismaError.meta?.target as string[];
        if (target?.includes("email") && target?.length === 1) {
          throw new ConflictException("Tenant email already exists");
        }
        if (target?.includes("email")) {
          throw new ConflictException(
            "A user with this email already exists in this tenant",
          );
        }
      }
      throw error;
    }

    // Generate JWT after successful registration
    const token = await this.generateToken({
      userId: (await this.prisma.user.findFirst({
        where: { email: dto.adminEmail },
      }))!.id,
      tenantId: (await this.prisma.tenant.findFirst({
        where: { email: dto.adminEmail },
      }))!.id,
      email: dto.adminEmail,
      role: "ADMIN",
    });

    return { accessToken: token };
  }

  /**
   * Authenticates user and returns JWT token.
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const token = await this.generateToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    return { accessToken: token };
  }

  private async generateToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
