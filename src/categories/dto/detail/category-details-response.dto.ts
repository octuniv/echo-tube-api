import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';
import { Category } from '../../entities/category.entity';

export class CategoryDetailsResponseDto {
  @ApiProperty({
    example: 1,
    description: '카테고리 ID',
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    example: 'Technology',
    description: '카테고리 이름',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: ['tech', 'innovation'],
    description: '허용된 슬러그 목록',
  })
  @IsArray()
  @IsString({ each: true })
  allowedSlugs: string[];

  @ApiProperty({
    example: [1, 2, 3],
    description: '연관된 게시판 ID 목록',
  })
  @IsArray()
  @IsNumber({}, { each: true })
  boardIds: number[];

  static fromEntity(category: Category): CategoryDetailsResponseDto {
    const dto = new CategoryDetailsResponseDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.allowedSlugs = category.slugs.map((s) => s.slug);
    dto.boardIds = category.boards?.map((b) => b.id) ?? [];
    return dto;
  }
}
