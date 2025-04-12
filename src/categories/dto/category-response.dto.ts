// src/categories/dto/category-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 'Technology' })
  name: string;

  @ApiProperty({ example: ['tech', 'innovation', 'gadgets'] })
  allowedSlugs: string[];
}
