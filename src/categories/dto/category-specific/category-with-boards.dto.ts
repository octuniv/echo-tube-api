import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryBoardGroup } from './category-board-group.dto';

export class CategoryWithBoardsResponse {
  @ApiProperty({ example: 'AI 뉴스', description: '카테고리 이름' })
  @IsString()
  name: string;

  @ApiProperty({
    description: '보드 그룹 목록 (용도별)',
    type: CategoryBoardGroup,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryBoardGroup)
  boardGroups: CategoryBoardGroup[];
}
