import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client"; // FIX: Imported for strict typing
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "./jwt.strategy";
import { RegisterTenantDto } from "./dto/register-tenant.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";

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

  async registerTenant(dto: RegisterTenantDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.adminPassword, BCRYPT_ROUNDS);

    try {
      const { tenant, user } = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.companyName, email: dto.adminEmail },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.adminEmail,
            passwordHash,
            role: "ADMIN",
          },
        });

        await tx.account.createMany({
          data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
            tenantId: tenant.id,
            ...account,
          })),
        });

        return { tenant, user };
      });

      const token = await this.generateToken({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
      });

      return { accessToken: token };
    } catch (error) {
      // FIX: Strict TypeScript check for Prisma errors
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = error.meta?.target as string[];
        if (target?.includes("email") && target?.length === 1) {
          throw new ConflictException("Tenant email already exists");
        }
        throw new ConflictException(
          "A user with this email already exists in this tenant",
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
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
