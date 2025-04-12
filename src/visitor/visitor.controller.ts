import { Controller, Get } from '@nestjs/common';
import { VisitorService } from './visitor.service';
import { TodayVisitorsResponseDto } from './dto/today-visitors-response.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorService) {}

  @Get('today')
  @ApiOperation({ summary: "Get today's unique visitor count" })
  @ApiResponse({
    status: 200,
    description: 'Visitor count for current day',
    type: TodayVisitorsResponseDto,
  })
  async getTodayVisitors(): Promise<TodayVisitorsResponseDto> {
    const count = await this.visitorsService.getTodayVisitors();
    return { count };
  }
}
