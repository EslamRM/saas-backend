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
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantInterceptor } from "../../common/interceptors/tenant.interceptor";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UseInterceptors } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { PlanResponseDto } from "./dto/plan-response.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@ApiTags("Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller("plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @Roles("ADMIN") // FIX: Admin only
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new subscription plan" })
  @ApiResponse({ status: 201, type: PlanResponseDto })
  async create(@Body() dto: CreatePlanDto): Promise<PlanResponseDto> {
    return this.plansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all plans" })
  @ApiResponse({ status: 200, type: [PlanResponseDto] })
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PlanResponseDto[]> {
    return this.plansService.findAll(pagination);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update a plan" })
  @ApiResponse({ status: 200, type: PlanResponseDto })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plansService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft delete a plan" })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    return this.plansService.softDelete(id);
  }
}
