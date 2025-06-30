import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoryResponseDto } from './dto/list/category-response.dto';
import { CategoryWithBoardsResponse } from './dto/category-specific/category-with-boards.dto';

// src/categories/categories.controller.ts
@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories with slugs' })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    type: [CategoryResponseDto],
  })
  async getAllCategories(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getAllCategoriesWithSlugs();
  }

  @Get('with-boards')
  @ApiOperation({
    summary: 'Get all categories with boards grouped by purpose',
  })
  @ApiResponse({
    status: 200,
    description: 'Successful response',
    type: [CategoryWithBoardsResponse],
  })
  async getCategoriesWithBoards(): Promise<CategoryWithBoardsResponse[]> {
    return this.categoriesService.getCategoriesWithBoards();
  }
}
