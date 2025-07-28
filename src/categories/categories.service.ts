import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategorySlug } from './entities/category-slug.entity';
import { CategoryResponseDto } from './dto/list/category-response.dto';
import { CategorySummaryResponseDto } from '../admin/category/dto/response/category-summary-response.dto';
import { UpdateCategoryDto } from '../admin/category/dto/CRUD/update-category.dto';
import { CreateCategoryDto } from '../admin/category/dto/CRUD/create-category.dto';
import { CategoryWithBoardsResponse } from './dto/category-specific/category-with-boards.dto';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { plainToInstance } from 'class-transformer';
import { CategoryBoardGroup } from './dto/category-specific/category-board-group.dto';
import { CategoryBoardSummary } from './dto/category-specific/category-board-summary.dto';
import { Transactional } from 'typeorm-transactional';
import {
  BOARD_ERROR_MESSAGES,
  CATEGORY_ERROR_MESSAGES,
} from '@/common/constants/error-messages.constants';
import { CategoryDetailsResponseDto } from '@/admin/category/dto/response/category-details-response.dto';
import { AvailableCategoryDto } from '@/admin/category/dto/available-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(CategorySlug)
    private categorySlugRepository: Repository<CategorySlug>,
  ) {}

  async isSlugUsed(slug: string, excludeCategoryId?: number): Promise<boolean> {
    const whereCondition = { slug };
    if (excludeCategoryId !== undefined) {
      whereCondition['category'] = {};
      whereCondition['category']['id'] = Not(excludeCategoryId);
    }
    return !!(await this.categorySlugRepository.findOne({
      where: whereCondition,
    }));
  }

  async isNameUsed(name: string, excludeCategoryId?: number): Promise<boolean> {
    const whereCondition = { name };
    if (excludeCategoryId !== undefined) {
      whereCondition['id'] = Not(excludeCategoryId);
    }
    return !!(await this.categoryRepository.findOne({ where: whereCondition }));
  }

  async verifySlugBelongsToCategory(
    categoryName: string,
    slug: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { name: categoryName },
      relations: ['slugs'],
    });

    if (!category) {
      throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    const isValid = category.slugs.some((s) => s.slug === slug);
    if (!isValid) {
      throw new BadRequestException({
        error: 'DUPLICATE_SLUG',
        message: CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS([slug]),
      });
    }
  }

  async findSlugsByCategory(categoryName: string): Promise<string[]> {
    const category = await this.categoryRepository.findOne({
      where: { name: categoryName },
      relations: ['slugs'],
    });

    return category?.slugs.map((s) => s.slug) || [];
  }

  async listAllCategoriesWithSlugs(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryRepository.find({
      relations: ['slugs'],
    });

    return categories.map((category) => ({
      name: category.name,
      allowedSlugs: category.slugs.map((slug) => slug.slug),
    }));
  }

  async getAllCategoriesForAdmin(): Promise<CategorySummaryResponseDto[]> {
    const categories = await this.categoryRepository.find({
      relations: {
        slugs: true,
        boards: {
          categorySlug: true,
        },
      },
    });

    return categories.map((category) =>
      CategorySummaryResponseDto.fromEntity(category),
    );
  }

  async getCategoryDetails(id: number): Promise<CategoryDetailsResponseDto> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: {
        slugs: true,
        boards: {
          categorySlug: true,
        },
      },
    });

    if (!category) {
      throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    return CategoryDetailsResponseDto.fromEntity(category);
  }

  @Transactional()
  async create(dto: CreateCategoryDto): Promise<CategorySummaryResponseDto> {
    if (dto.allowedSlugs.length === 0) {
      throw new BadRequestException(CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED);
    }

    const existingCategory = await this.categoryRepository.findOne({
      where: { name: dto.name },
    });

    if (existingCategory) {
      throw new ConflictException(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
      );
    }

    const category = this.categoryRepository.create({ name: dto.name });
    const savedCategory = await this.categoryRepository.save(category);

    const existingSlugs = await this.categorySlugRepository.find({
      where: { slug: In(dto.allowedSlugs) },
    });
    if (existingSlugs.length > 0) {
      const duplicateSlugs = existingSlugs.map((s) => s.slug);
      throw new BadRequestException(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(duplicateSlugs),
      );
    }

    const slugs = dto.allowedSlugs.map((slug) =>
      this.categorySlugRepository.create({
        slug,
        category: savedCategory,
      }),
    );
    await this.categorySlugRepository.save(slugs);

    const fullCategory = await this.categoryRepository.findOne({
      where: { id: savedCategory.id },
      relations: ['slugs', 'boards'],
    });

    return CategorySummaryResponseDto.fromEntity(fullCategory);
  }

  @Transactional()
  async update(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<CategorySummaryResponseDto> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs'],
    });
    if (!category)
      throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    const existingCategory = await this.categoryRepository.findOne({
      where: { name: dto.name, id: Not(id) },
    });
    if (existingCategory) {
      throw new ConflictException(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
      );
    }
    category.name = dto.name;

    if (dto.allowedSlugs.length === 0) {
      throw new BadRequestException(CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED);
    }

    const existingSlugs = await this.categorySlugRepository.find({
      where: {
        slug: In(dto.allowedSlugs),
        category: { id: Not(id) },
      },
    });

    if (existingSlugs.length > 0) {
      const duplicateSlugs = existingSlugs.map((s) => s.slug);
      throw new BadRequestException(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(duplicateSlugs),
      );
    }

    const oldSlugs = category.slugs.map((s) => s.slug);
    const newSlugs = dto.allowedSlugs;

    const slugsToDelete = category.slugs.filter(
      (slug) => !newSlugs.includes(slug.slug),
    );

    await this.categorySlugRepository.remove(slugsToDelete);

    const slugsToAdd = newSlugs
      .filter((slug) => !oldSlugs.includes(slug))
      .map((slug) => this.categorySlugRepository.create({ slug, category }));

    const newSlugsEntities = await this.categorySlugRepository.save(slugsToAdd);

    category.slugs = [
      ...category.slugs.filter((slug) => newSlugs.includes(slug.slug)),
      ...(newSlugsEntities || []),
    ];

    await this.categoryRepository.save(category);

    const updatedCategory = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs', 'boards'],
    });
    return CategorySummaryResponseDto.fromEntity(updatedCategory);
  }

  async remove(id: number): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['boards'],
    });
    if (!category)
      throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    await this.categoryRepository.remove(category);
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs', 'boards'],
    });
    if (!category)
      throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    return category;
  }

  async getCategoriesWithBoards(): Promise<CategoryWithBoardsResponse[]> {
    const categories = await this.categoryRepository.find({
      relations: {
        boards: {
          categorySlug: true,
        },
      },
    });

    return categories.map((category) => {
      const boardGroups = Object.values(BoardPurpose).map((purpose) => {
        const boards = category.boards
          .filter((board) => board.type === purpose)
          .map((board) =>
            plainToInstance(CategoryBoardSummary, {
              id: board.id,
              slug: board.categorySlug.slug,
              name: board.name,
            }),
          );

        const boardGroup = plainToInstance(CategoryBoardGroup, {
          purpose,
          boards,
        });

        return boardGroup;
      });

      const dto = plainToInstance(CategoryWithBoardsResponse, {
        name: category.name,
        boardGroups,
      });

      return dto;
    });
  }

  async validateSlugWithinCategory(
    slug: string,
    categoryId: number,
  ): Promise<CategorySlug> {
    const categorySlug = await this.categorySlugRepository.findOne({
      where: { slug, category: { id: categoryId } },
      relations: { category: true },
    });
    if (!categorySlug) {
      throw new BadRequestException(
        BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(slug),
      );
    }
    return categorySlug;
  }

  async getAvailableCategories(
    boardId?: number,
  ): Promise<AvailableCategoryDto[]> {
    const categories = await this.categoryRepository.find({
      relations: { slugs: true, boards: { categorySlug: true } },
    });

    return categories.map((category) => {
      const usedSlugs = category.boards
        .filter((board) => (boardId ? board.id !== boardId : true))
        .map((board) => board.categorySlug.slug);

      return {
        id: category.id,
        name: category.name,
        availableSlugs: category.slugs
          .filter((slug) => !usedSlugs.includes(slug.slug))
          .map((slug) => ({ slug: slug.slug })),
      };
    });
  }
}
