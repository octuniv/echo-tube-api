import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard.summary.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary data' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary containing visitor stats and posts',
    type: DashboardSummaryDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error when fetching data',
  })
  async getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getDashboardSummary();
  }
}
