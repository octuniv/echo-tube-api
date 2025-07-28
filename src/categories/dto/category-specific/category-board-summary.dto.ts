import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class CategoryBoardSummary {
  @ApiProperty({ example: 1, description: '보드 ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 'ai-general', description: '보드 슬러그' })
  @IsString()
  slug: string;

  @ApiProperty({ example: '일반 게시판', description: '보드 이름' })
  @IsString()
  name: string;
}
