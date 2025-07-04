import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { CategoriesService } from '@/categories/categories.service';
import { CreateCategoryDto } from '@/categories/dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from '@/categories/dto/CRUD/update-category.dto';
import { CategorySummaryResponseDto } from '@/admin/category/dto/response/category-summary-response.dto';
import { ValidateSlugQueryDto } from './dto/query/validate-slug.query.dto';
import { CATEGORY_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';
import { CategoryDetailsResponseDto } from './dto/response/category-details-response.dto';

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
    description:
      '관리자 권한으로 모든 카테고리 목록과 관련 슬러그를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    type: [CategorySummaryResponseDto],
    description: '성공적으로 조회됨',
  })
  async getAllCategoriesForAdmin(): Promise<CategorySummaryResponseDto[]> {
    return this.categoriesService.getAllCategoriesForAdmin();
  }

  @Post()
  @ApiOperation({
    summary: '새 카테고리 생성',
    description: '새로운 카테고리와 관련 슬러그를 생성합니다.',
  })
  @ApiBody({
    type: CreateCategoryDto,
    examples: {
      default: {
        value: { name: 'Technology', allowedSlugs: ['tech', 'innovation'] },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: CategorySummaryResponseDto,
    description: '성공적으로 생성됨',
  })
  @ApiResponse({
    status: 400,
    description: '유효성 검증 실패 (슬러그 중복 또는 슬러그 누락)',
    examples: {
      duplicateSlug: {
        summary: '슬러그 중복',
        value: {
          statusCode: 400,
          message: [CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(['tech'])],
          error: 'Bad Request',
        },
      },
      emptySlugs: {
        summary: '슬러그 누락',
        value: {
          statusCode: 400,
          message: [CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED],
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '카테고리 이름 중복',
    example: {
      statusCode: 409,
      message: '이미 사용 중인 카테고리 이름입니다.',
      error: 'Conflict',
    },
  })
  async createCategory(
    @Body() dto: CreateCategoryDto,
  ): Promise<CategorySummaryResponseDto> {
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
    type: CategorySummaryResponseDto,
    description: '성공적으로 조회됨',
  })
  @ApiResponse({
    status: 404,
    description: '카테고리를 찾을 수 없음',
    schema: {
      example: {
        statusCode: 404,
        message: '카테고리를 찾을 수 없습니다.',
        error: 'Not Found',
      },
    },
  })
  async getCategoryDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CategoryDetailsResponseDto> {
    return this.categoriesService.getCategoryDetails(id);
  }

  @Get(':id/validate-slug')
  @ApiOperation({
    summary: '슬러그 중복 검증',
    description: '해당 슬러그가 다른 카테고리에서 사용 중인지 확인합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '검증 대상 카테고리 ID',
  })
  @ApiQuery({
    name: 'slug',
    type: 'string',
    example: 'tech',
    description: '검증할 슬러그 값',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: { isUsedInOtherCategory: false },
    },
    description: '성공',
  })
  @ApiResponse({
    status: 400,
    description: '유효성 검증 실패 (슬러그 누락)',
    schema: {
      example: {
        statusCode: 400,
        message: ['slug should not be empty'],
        error: 'Bad Request',
      },
    },
  })
  async validateSlugInOtherCategory(
    @Param('id', ParseIntPipe) categoryId: number,
    @Query() dto: ValidateSlugQueryDto,
  ): Promise<{ isUsedInOtherCategory: boolean }> {
    const isUsed = await this.categoriesService.isSlugUsedInOtherCategory(
      dto.slug,
      categoryId,
    );
    return { isUsedInOtherCategory: isUsed };
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
    type: CategorySummaryResponseDto,
    description: '성공적으로 업데이트됨',
  })
  @ApiResponse({
    status: 400,
    description: '유효성 검증 실패 (슬러그 중복 또는 슬러그 누락)',
    examples: {
      duplicateSlug: {
        summary: '슬러그 중복',
        value: {
          statusCode: 400,
          message: [CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(['tech'])],
          error: 'Bad Request',
        },
      },
      emptySlugs: {
        summary: '슬러그 누락',
        value: {
          statusCode: 400,
          message: [CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED],
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '카테고리 이름 중복',
    example: {
      statusCode: 409,
      message: '이미 사용 중인 카테고리 이름입니다.',
      error: 'Conflict',
    },
  })
  @ApiResponse({
    status: 404,
    description: '카테고리를 찾을 수 없음',
  })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategorySummaryResponseDto> {
    return this.categoriesService.update(id, dto);
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
    schema: {
      example: {
        statusCode: 404,
        message: '카테고리를 찾을 수 없습니다.',
        error: 'Not Found',
      },
    },
  })
  async deleteCategory(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
