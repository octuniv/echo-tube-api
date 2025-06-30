import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(CategorySlug)
    private categorySlugRepository: Repository<CategorySlug>,
  ) {}

  async validateSlug(categoryName: string, slug: string): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { name: categoryName },
      relations: ['slugs'],
    });

    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    const isValid = category.slugs.some((s) => s.slug === slug);
    if (!isValid) {
      throw new BadRequestException('허용되지 않는 Slug입니다');
    }
  }

  async getSlugsByCategory(categoryName: string): Promise<string[]> {
    const category = await this.categoryRepository.findOne({
      where: { name: categoryName },
      relations: ['slugs'],
    });

    return category?.slugs.map((s) => s.slug) || [];
  }

  async getAllCategoriesWithSlugs(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryRepository.find({
      relations: ['slugs'],
    });

    return categories.map((category) => ({
      name: category.name,
      allowedSlugs: category.slugs.map((slug) => slug.slug),
    }));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDetailsResponseDto> {
    const existingCategory = await this.categoryRepository.findOne({
      where: { name: dto.name },
    });

    if (existingCategory) {
      throw new BadRequestException('이미 존재하는 카테고리 이름입니다.');
    }

    const category = this.categoryRepository.create({ name: dto.name });
    const savedCategory = await this.categoryRepository.save(category);

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

  async update(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDetailsResponseDto> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs'],
    });
    if (!category) throw new NotFoundException('Category not found');

    if (dto.name) category.name = dto.name;
    if (dto.allowedSlugs) {
      await this.categorySlugRepository.delete({
        category: { id },
      });
      const slugs = dto.allowedSlugs.map((slug) =>
        this.categorySlugRepository.create({ slug, category }),
      );
      await this.categorySlugRepository.save(slugs);
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
    if (!category) throw new NotFoundException('Category not found');

    await this.categoryRepository.remove(category);
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['slugs', 'boards'],
    });
    if (!category) throw new NotFoundException('Category not found');

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
