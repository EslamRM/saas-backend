import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { SubscriptionResponseDto } from "./dto/subscription-response.dto";
import { TenantContext } from "@/common/tenant-context";
import { PaginationDto } from "../../common/dto/pagination.dto";

type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: { customer: true; plan: true };
}>;

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const tenantId = TenantContext.requireTenantId();

    // Verify plan exists and is active (explicit check for better error message)
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: dto.planId,
        tenantId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new BadRequestException("Active plan not found for this tenant");
    }

    // Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        tenantId,
      },
    });

    if (!customer) {
      throw new BadRequestException("Customer not found for this tenant");
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        planId: dto.planId,
        status: "ACTIVE",
        startDate: new Date(dto.startDate),
        nextBillingDate: new Date(dto.startDate),
      },
      include: {
        customer: true,
        plan: true,
      },
    });

    return SubscriptionsService.toResponseDto(subscription);
  }

  async findAll(pagination: PaginationDto): Promise<SubscriptionResponseDto[]> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const subscriptions = await this.prisma.subscription.findMany({
      include: { customer: true, plan: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return subscriptions.map(SubscriptionsService.toResponseDto);
  }

  async cancel(id: string): Promise<SubscriptionResponseDto> {
    try {
      const subscription = await this.prisma.subscription.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { customer: true, plan: true },
      });

      return SubscriptionsService.toResponseDto(subscription);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Subscription not found for this tenant");
      }
      throw error;
    }
  }

  private static toResponseDto(
    subscription: SubscriptionWithRelations,
  ): SubscriptionResponseDto {
    return {
      id: subscription.id,
      customerId: subscription.customerId,
      customerName: subscription.customer?.name,
      planId: subscription.planId,
      planName: subscription.plan?.name,
      status: subscription.status,
      startDate: subscription.startDate,
      nextBillingDate: subscription.nextBillingDate,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
