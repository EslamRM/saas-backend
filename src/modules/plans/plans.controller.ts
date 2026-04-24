import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
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
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { PlanResponseDto } from "./dto/plan-response.dto";

@ApiTags("Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller("plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new subscription plan" })
  @ApiResponse({ status: 201, type: PlanResponseDto })
  async create(@Body() dto: CreatePlanDto): Promise<PlanResponseDto> {
    return this.plansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all plans (active and inactive)" })
  @ApiResponse({ status: 200, type: [PlanResponseDto] })
  async findAll(): Promise<PlanResponseDto[]> {
    return this.plansService.findAll();
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a plan" })
  @ApiResponse({ status: 200, type: PlanResponseDto })
  @ApiResponse({ status: 404, description: "Plan not found" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plansService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft delete a plan (sets isActive=false)" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: "Plan not found" })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    return this.plansService.softDelete(id);
  }
}
