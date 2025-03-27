import { Controller, Get } from '@nestjs/common';
import { VisitorService } from './visitor.service';

@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorService) {}

  @Get('today')
  async getTodayVisitors(): Promise<{ count: number }> {
    const count = await this.visitorsService.getTodayVisitors();
    return { count };
  }
}
