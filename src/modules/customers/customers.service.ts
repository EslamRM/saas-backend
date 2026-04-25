import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, Customer } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant-context";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomerResponseDto } from "./dto/customer-response.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto): Promise<CustomerResponseDto> {
    const tenantId = TenantContext.requireTenantId();
    try {
      const customer = await this.prisma.customer.create({
        data: { tenantId, name: dto.name, email: dto.email },
      });
      return CustomersService.toResponseDto(customer);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A customer with this email already exists in this tenant",
        );
      }
      throw error;
    }
  }

  async findAll(pagination: PaginationDto): Promise<CustomerResponseDto[]> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const customers = await this.prisma.customer.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return customers.map(CustomersService.toResponseDto);
  }

  async findOne(id: string): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer)
      throw new NotFoundException("Customer not found for this tenant");
    return CustomersService.toResponseDto(customer);
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: dto,
      });
      return CustomersService.toResponseDto(customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025")
          throw new NotFoundException("Customer not found for this tenant");
        if (error.code === "P2002")
          throw new ConflictException(
            "A customer with this email already exists in this tenant",
          );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ success: boolean }> {
    try {
      await this.prisma.customer.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Customer not found");
      }
      throw error;
    }
  }

  private static toResponseDto(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
