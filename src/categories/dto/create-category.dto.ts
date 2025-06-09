// src/categories/dto/create-category.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Technology' })
  @IsString()
  name: string;

  @ApiProperty({ example: ['tech', 'innovation'] })
  @IsArray()
  @IsString({ each: true })
  allowedSlugs: string[];
}
