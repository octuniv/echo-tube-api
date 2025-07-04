import { BoardSummaryDto } from '@/boards/dto/board-summary.dto';
import { Category } from '@/categories/entities/category.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CategoryDetailsResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Technology' })
  name: string;

  @ApiProperty({ example: ['tech', 'innovation'] })
  allowedSlugs: string[];

  @ApiProperty({ type: [BoardSummaryDto] }) // 보드 상세 정보
  boards: BoardSummaryDto[];

  @ApiProperty({ example: '2023-01-01T00:00:00Z' }) // 감사 정보
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updatedAt: Date;

  static fromEntity(category: Category): CategoryDetailsResponseDto {
    const dto = new CategoryDetailsResponseDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.allowedSlugs = category.slugs.map((s) => s.slug);
    dto.boards =
      category.boards?.map((b) => BoardSummaryDto.fromEntity(b)) ?? [];
    dto.createdAt = category.createdAt;
    dto.updatedAt = category.updatedAt;
    return dto;
  }
}
