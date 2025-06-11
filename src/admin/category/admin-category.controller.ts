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
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
@ApiBearerAuth()
export class AdminCategoryController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary: '모든 카테고리 조회',
    description: '관리자 권한으로 모든 카테고리 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    type: [CategoryResponseDto],
    description: '성공적으로 조회됨',
  })
  async getCategories(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getAllCategoriesWithSlugs();
  }

  @Post()
  @ApiOperation({
    summary: '새 카테고리 생성',
    description: '새로운 카테고리를 생성합니다.',
  })
  @ApiBody({
    type: CreateCategoryDto,
    examples: {
      default: {
        value: {
          name: 'Technology',
          allowedSlugs: ['tech', 'innovation'],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: CategoryDetailsResponseDto,
    description: '성공적으로 생성됨',
  })
  async createCategory(
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDetailsResponseDto> {
    return this.categoriesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: '카테고리 상세 조회',
    description: '특정 ID의 카테고리 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '조회할 카테고리의 ID',
  })
  @ApiResponse({
    status: 200,
    type: CategoryDetailsResponseDto,
    description: '성공적으로 조회됨',
  })
  @ApiResponse({
    status: 404,
    description: '카테고리를 찾을 수 없음',
  })
  async getCategoryDetails(
    @Param('id') id: string,
  ): Promise<CategoryDetailsResponseDto> {
    const category = await this.categoriesService.findOne(+id);
    return CategoryDetailsResponseDto.fromEntity(category);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '카테고리 정보 업데이트',
    description: '특정 ID의 카테고리 정보를 업데이트합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '업데이트할 카테고리의 ID',
  })
  @ApiBody({
    type: UpdateCategoryDto,
    examples: {
      default: {
        value: {
          name: 'Updated Technology',
          allowedSlugs: ['technology', 'tech-news'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: CategoryDetailsResponseDto,
    description: '성공적으로 업데이트됨',
  })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDetailsResponseDto> {
    return this.categoriesService.update(+id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '카테고리 삭제',
    description:
      '특정 ID의 카테고리를 삭제합니다 (연관된 게시판도 함께 삭제됩니다).',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '삭제할 카테고리의 ID',
  })
  @ApiResponse({
    status: 200,
    description: '성공적으로 삭제됨',
  })
  @ApiResponse({
    status: 404,
    description: '카테고리를 찾을 수 없음',
  })
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(+id);
  }
}
