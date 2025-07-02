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
import { CategoryDetailsResponseDto } from './dto/detail/category-details-response.dto';
import { UpdateCategoryDto } from './dto/CRUD/update-category.dto';
import { CreateCategoryDto } from './dto/CRUD/create-category.dto';
import { CategoryWithBoardsResponse } from './dto/category-specific/category-with-boards.dto';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { plainToClass } from 'class-transformer';
import { CategoryBoardGroup } from './dto/category-specific/category-board-group.dto';
import { CategoryBoardSummary } from './dto/category-specific/category-board-summary.dto';
import { Transactional } from 'typeorm-transactional';
import { CATEGORY_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(CategorySlug)
    private categorySlugRepository: Repository<CategorySlug>,
  ) {}

  async isSlugUsedInOtherCategory(
    slug: string,
    categoryId: number,
  ): Promise<boolean> {
    const existingSlug = await this.categorySlugRepository.findOne({
      where: {
        slug,
        category: {
          id: Not(categoryId),
        },
      },
    });
    return !!existingSlug;
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
        message: CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUG(slug),
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

  @Transactional()
  async create(dto: CreateCategoryDto): Promise<CategoryDetailsResponseDto> {
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

    for (const slug of dto.allowedSlugs) {
      const existingSlug = await this.categorySlugRepository.findOne({
        where: { slug },
      });
      if (existingSlug) {
        throw new BadRequestException(
          CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUG(slug),
        );
      }
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

    return CategoryDetailsResponseDto.fromEntity(fullCategory);
  }

  @Transactional()
  async update(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDetailsResponseDto> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs'],
    });
    if (!category)
      throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    if (dto.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { name: dto.name, id: Not(id) },
      });
      if (existingCategory) {
        throw new ConflictException(
          CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
        );
      }
      category.name = dto.name;
    }

    if (dto.allowedSlugs) {
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

      const newSlugsEntities =
        await this.categorySlugRepository.save(slugsToAdd);

      category.slugs = [
        ...category.slugs.filter((slug) => newSlugs.includes(slug.slug)),
        ...(newSlugsEntities || []),
      ];
    }

    await this.categoryRepository.save(category);

    const updatedCategory = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs', 'boards'],
    });
    return CategoryDetailsResponseDto.fromEntity(updatedCategory);
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
      relations: ['boards'],
    });

    return categories.map((category) => {
      const boardGroups = Object.values(BoardPurpose).map((purpose) => {
        const boards = category.boards
          .filter((board) => board.type === purpose)
          .map((board) =>
            plainToClass(CategoryBoardSummary, {
              id: board.id,
              slug: board.slug,
              name: board.name,
            }),
          );

        const boardGroup = plainToClass(CategoryBoardGroup, {
          purpose,
          boards,
        });

        return boardGroup;
      });

      const dto = plainToClass(CategoryWithBoardsResponse, {
        name: category.name,
        boardGroups,
      });

      return dto;
    });
  }
}
