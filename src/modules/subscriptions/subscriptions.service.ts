import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { TenantContext } from '@/common/tenant-context';

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
      throw new BadRequestException(
        'Active plan not found for this tenant',
      );
    }

    // Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.customerId,
        tenantId,
      },
    });

    if (!customer) {
      throw new BadRequestException(
        'Customer not found for this tenant',
      );
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        planId: dto.planId,
        status: 'ACTIVE',
        startDate: new Date(dto.startDate),
        nextBillingDate: new Date(dto.startDate),
      },
      include: {
        customer: true,
        plan: true,
      },
    });

    return this.toResponseDto(subscription);
  }

  async findAll(): Promise<SubscriptionResponseDto[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      include: {
        customer: true,
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map(this.toResponseDto);
  }

  private toResponseDto(subscription: any): SubscriptionResponseDto {
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