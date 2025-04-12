// visitors/dto/today-visitors-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TodayVisitorsResponseDto {
  @ApiProperty({ example: 150, description: "Today's unique visitor count" })
  count: number;
}
