import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { CategoriesService } from '@/categories/categories.service';
import { CategoryResponseDto } from '@/categories/dto/category-response.dto';
import { CreateCategoryDto } from '@/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/categories/dto/update-category.dto';
import { CategoryDetailsResponseDto } from '@/categories/dto/category-details-response.dto';

@ApiTags('admin-categories')
@Controller('admin/categories')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCategoryController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories(): Promise<CategoryResponseDto[]> {
    // 전체 카테고리 조회
    return this.categoriesService.getAllCategoriesWithSlugs();
  }

  @Post()
  async createCategory(
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDetailsResponseDto> {
    // 새로운 카테고리 생성
    return this.categoriesService.create(dto);
  }

  @Get(':id')
  async getCategoryDetails(
    @Param('id') id: string,
  ): Promise<CategoryDetailsResponseDto> {
    const category = await this.categoriesService.findOne(+id);
    return CategoryDetailsResponseDto.fromEntity(category);
  }

  @Patch(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDetailsResponseDto> {
    // 카테고리 정보 업데이트
    return this.categoriesService.update(+id, dto);
  }

  @Delete(':id')
  async deleteCategory(@Param('id') id: string): Promise<void> {
    // 카테고리 삭제 (연관 게시판도 삭제)
    return this.categoriesService.remove(+id);
  }
}
