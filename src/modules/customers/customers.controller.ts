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
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomerResponseDto } from "./dto/customer-response.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@ApiTags("Customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new customer" })
  async create(@Body() dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    return this.customersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List all customers" })
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<CustomerResponseDto[]> {
    return this.customersService.findAll(pagination);
  }

  @Patch(":id")
  @Roles("ADMIN")
  @ApiOperation({ summary: "Update a customer" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft delete a customer" })
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    return this.customersService.remove(id);
  }
}
