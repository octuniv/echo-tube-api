import {
  Controller,
  // Get,
  // Post,
  // Patch,
  // Delete,
  // Param,
  // Body,
  UseGuards,
} from '@nestjs/common';
// import { CreateCategoryDto } from './dto/create-category.dto';
// import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { CategoriesService } from '@/categories/categories.service';

@ApiTags('admin-categories')
@Controller('admin/categories')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCategoryController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // @Get()
  // async getCategories() {
  //   // 전체 카테고리 조회
  //   return this.categoryService.findAll();
  // }

  // @Post()
  // async createCategory(@Body() dto: CreateCategoryDto) {
  //   // 새로운 카테고리 생성
  //   return this.categoryService.create(dto);
  // }

  // @Get(':id')
  // async getCategoryDetails(@Param('id') id: string) {
  //   // 특정 카테고리 상세 조회 (슬러그, 게시판 포함)
  //   return this.categoryService.findOne(+id);
  // }

  // @Patch(':id')
  // async updateCategory(
  //   @Param('id') id: string,
  //   @Body() dto: UpdateCategoryDto,
  // ) {
  //   // 카테고리 정보 업데이트
  //   return this.categoryService.update(+id, dto);
  // }

  // @Delete(':id')
  // async deleteCategory(@Param('id') id: string) {
  //   // 카테고리 삭제 (연관 게시판도 삭제)
  //   return this.categoryService.remove(+id);
  // }
}
