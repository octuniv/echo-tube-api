import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { CategorySlug } from './entities/category-slug.entity';
import {
  createCategory,
  createCategorySlug,
} from './factories/category.factory';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: Repository<Category>;
  // let categorySlugRepository: Repository<CategorySlug>;

  const mockCategoryName = 'Test Category';
  const mockSlugs = ['valid-slug-1', 'valid-slug-2'];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: createMock<Repository<Category>>(),
        },
        {
          provide: getRepositoryToken(CategorySlug),
          useValue: createMock<Repository<CategorySlug>>(),
        },
      ],
    }).compile();

    service = module.get(CategoriesService);
    categoryRepository = module.get(getRepositoryToken(Category));
    // categorySlugRepository = module.get(getRepositoryToken(CategorySlug));
  });

  describe('validateSlug', () => {
    it('유효한 slug인 경우 정상 처리', async () => {
      const mockCategory = createCategory({
        name: mockCategoryName,
        slugs: mockSlugs.map((slug) => createCategorySlug({ slug })), // 명시적 slug 전달
      });

      categoryRepository.findOne = jest.fn().mockResolvedValue(mockCategory);

      await expect(
        service.validateSlug(mockCategoryName, mockSlugs[0]),
      ).resolves.not.toThrow();
    });

    it('유효하지 않은 slug인 경우 에러 발생', async () => {
      const mockCategory = createCategory({
        name: mockCategoryName,
        slugs: mockSlugs.map((slug) => createCategorySlug({ slug })),
      });

      categoryRepository.findOne = jest.fn().mockResolvedValue(mockCategory);

      await expect(
        service.validateSlug(mockCategoryName, 'invalid-slug'),
      ).rejects.toThrow(BadRequestException);
    });

    it('존재하지 않는 카테고리인 경우 에러 발생', async () => {
      categoryRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.validateSlug('non-existent', 'slug'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSlugsByCategory', () => {
    it('존재하는 카테고리의 slug 목록 반환', async () => {
      const mockCategory = createCategory({
        name: mockCategoryName,
        slugs: mockSlugs.map((slug) => createCategorySlug({ slug })),
      });

      categoryRepository.findOne = jest.fn().mockResolvedValue(mockCategory);

      const result = await service.getSlugsByCategory(mockCategoryName);
      expect(result).toEqual(mockSlugs);
    });

    it('존재하지 않는 카테고리인 경우 빈 배열 반환', async () => {
      categoryRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.getSlugsByCategory('non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('getAllCategoriesWithSlugs', () => {
    it('모든 카테고리와 slug 목록 반환', async () => {
      const mockCategory1 = createCategory({
        name: '공지사항',
        slugs: ['announcements', 'notices'].map((slug) =>
          createCategorySlug({ slug }),
        ),
      });
      const mockCategory2 = createCategory({
        name: '커뮤니티',
        slugs: ['free', 'humor', 'qna'].map((slug) =>
          createCategorySlug({ slug }),
        ),
      });

      categoryRepository.find = jest
        .fn()
        .mockResolvedValue([mockCategory1, mockCategory2]);

      const result = await service.getAllCategoriesWithSlugs();
      expect(result).toEqual([
        {
          name: '공지사항',
          allowedSlugs: ['announcements', 'notices'],
        },
        {
          name: '커뮤니티',
          allowedSlugs: ['free', 'humor', 'qna'],
        },
      ]);
    });

    it('카테고리가 없는 경우 빈 배열 반환', async () => {
      categoryRepository.find = jest.fn().mockResolvedValue([]);
      const result = await service.getAllCategoriesWithSlugs();
      expect(result).toEqual([]);
    });
  });
});
