import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CategorySlug } from './entities/category-slug.entity';

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

  async getAllCategoriesWithSlugs(): Promise<
    { name: string; allowedSlugs: string[] }[]
  > {
    const categories = await this.categoryRepository.find({
      relations: ['slugs'],
    });

    return categories.map((category) => ({
      name: category.name,
      allowedSlugs: category.slugs.map((slug) => slug.slug),
    }));
  }
}
