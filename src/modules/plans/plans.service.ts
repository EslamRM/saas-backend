import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "@/common/tenant-context";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { PlanResponseDto } from "./dto/plan-response.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PlanResponseDto[]> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const plans = await this.prisma.plan.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return plans.map(this.toResponseDto);
  }

  async create(dto: CreatePlanDto): Promise<PlanResponseDto> {
    const tenantId = TenantContext.requireTenantId();
    const plan = await this.prisma.plan.create({
      data: {
        tenantId,
        name: dto.name,
        price: dto.price,
        currency: dto.currency || "USD",
        intervalDays: dto.intervalDays,
      },
    });

    return this.toResponseDto(plan);
  }

  async findOne(id: string): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      throw new NotFoundException(`Plan not found for this tenant`);
    }

    return this.toResponseDto(plan);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    try {
      const plan = await this.prisma.plan.update({
        where: { id },
        data: dto,
      });

      return this.toResponseDto(plan);
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") {
        throw new NotFoundException(`Plan not found for this tenant`);
      }
      throw error;
    }
  }

  async softDelete(id: string): Promise<{ success: boolean }> {
    try {
      await this.prisma.plan.update({
        where: { id },
        data: { isActive: false },
      });

      return { success: true };
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") {
        throw new NotFoundException(`Plan not found for this tenant`);
      }
      throw error;
    }
  }

  private toResponseDto(plan: any): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      currency: plan.currency,
      intervalDays: plan.intervalDays,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
