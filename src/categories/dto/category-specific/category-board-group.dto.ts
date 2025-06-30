import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { CategoryBoardSummary } from './category-board-summary.dto';

export class CategoryBoardGroup {
  @ApiProperty({ enum: BoardPurpose, description: '보드 용도 (일반/봇 수집)' })
  @IsEnum(BoardPurpose)
  purpose: BoardPurpose;

  @ApiProperty({
    description: '보드 목록',
    type: 'object',
    isArray: true,
    properties: {
      id: { type: 'number' },
      slug: { type: 'string' },
      name: { type: 'string' },
    },
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryBoardSummary)
  boards: CategoryBoardSummary[];
}
