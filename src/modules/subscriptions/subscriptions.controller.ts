import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { TenantInterceptor } from "@/common/interceptors/tenant.interceptor";
import { UseInterceptors } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { SubscriptionResponseDto } from "./dto/subscription-response.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@ApiTags("Subscriptions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new subscription",
    description:
      "Creates an active subscription. nextBillingDate is set to startDate.",
  })
  @ApiResponse({ status: 201, type: SubscriptionResponseDto })
  async create(
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all subscriptions" })
  @ApiResponse({ status: 200, type: [SubscriptionResponseDto] })
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<SubscriptionResponseDto[]> {
    return this.subscriptionsService.findAll(pagination);
  }

  @Patch(":id/cancel")
  @ApiOperation({
    summary: "Cancel a subscription",
    description: "Marks an active subscription as CANCELLED.",
  })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  @ApiResponse({ status: 404, description: "Subscription not found" })
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.cancel(id);
  }
}
