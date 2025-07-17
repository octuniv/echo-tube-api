// src/categories/dto/available-category.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AvailableCategorySlugDto {
  @ApiProperty({ example: 'tech' })
  slug: string;
}

export class AvailableCategoryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Technology' })
  name: string;

  @ApiProperty({ type: [AvailableCategorySlugDto] })
  availableSlugs: AvailableCategorySlugDto[];
}
