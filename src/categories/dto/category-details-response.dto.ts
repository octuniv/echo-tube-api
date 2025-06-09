// src/categories/dto/category-details-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsString } from 'class-validator';
import { Category } from '../entities/category.entity';

export class CategoryDetailsResponseDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 'Technology' })
  @IsString()
  name: string;

  @ApiProperty({ example: ['tech', 'innovation'] })
  @IsArray()
  @IsString({ each: true })
  allowedSlugs: string[];

  @ApiProperty({ example: [1, 2, 3] })
  @IsArray()
  @IsNumber({}, { each: true })
  boardIds: number[];

  // 정적 팩토리 메서드로 엔티티 변환
  static fromEntity(category: Category): CategoryDetailsResponseDto {
    const dto = new CategoryDetailsResponseDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.allowedSlugs = category.slugs.map((s) => s.slug);
    dto.boardIds = category.boards?.map((b) => b.id) ?? [];
    return dto;
  }
}
