import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

// src/categories/categories.controller.ts
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getAllCategories(): Promise<
    { name: string; allowedSlugs: string[] }[]
  > {
    return this.categoriesService.getAllCategoriesWithSlugs();
  }
}
