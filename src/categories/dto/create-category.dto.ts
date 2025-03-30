import { IsArray, IsString } from 'class-validator';

// src/categories/dto/create-category.dto.ts
export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  slugs: string[];
}
