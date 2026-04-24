import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TenantInterceptor } from '@/common/interceptors/tenant.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { RecognizeRevenueDto } from './dto/recognize-revenue.dto';

@ApiTags('Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('recognize-revenue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recognize revenue for a month (month-end close)',
    description:
      'Finds all PAID invoices where periodEnd falls within the specified month and creates revenue recognition journal entries for those not yet recognized.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        recognized: { type: 'number', example: 3 },
        message: { type: 'string' },
      },
    },
  })
  async recognizeRevenue(
    @Body() dto: RecognizeRevenueDto,
  ): Promise<{ recognized: number; message: string }> {
    const count = await this.accountingService.recognizeRevenue(dto.month);
    return {
      recognized: count,
      message: `${count} revenue recognition entry(ies) created`,
    };
  }
}