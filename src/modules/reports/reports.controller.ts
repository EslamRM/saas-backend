import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TenantInterceptor } from '@/common/interceptors/tenant.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { BalanceSheetDto } from './dto/balance-sheet.dto';
import { IncomeStatementDto } from './dto/income-statement.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('balance-sheet')
  @ApiOperation({
    summary: 'Get balance sheet',
    description:
      'Returns current balances for asset and liability accounts. All balances are computed from journal lines (no stored balance fields).',
  })
  @ApiResponse({ status: 200, type: BalanceSheetDto })
  async getBalanceSheet(): Promise<BalanceSheetDto> {
    return this.reportsService.getBalanceSheet();
  }

  @Get('income-statement')
  @ApiOperation({
    summary: 'Get income statement',
    description:
      'Returns revenue for the specified period. All amounts are computed from journal lines.',
  })
  @ApiQuery({ name: 'from', required: true, example: '2025-01-01', description: 'Period start (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: true, example: '2025-01-31', description: 'Period end (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, type: IncomeStatementDto })
  async getIncomeStatement(
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<IncomeStatementDto> {
    return this.reportsService.getIncomeStatement(
      new Date(from),
      new Date(to),
    );
  }
}