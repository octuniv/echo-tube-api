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
import { CreateCategoryDto } from './dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from './dto/CRUD/update-category.dto';
import { createBoard } from '@/boards/factories/board.factory';
import { BoardPurpose } from '@/boards/entities/board.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: Repository<Category>;
  let categorySlugRepository: Repository<CategorySlug>;

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
    categorySlugRepository = module.get(getRepositoryToken(CategorySlug));
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

  describe('create', () => {
    const dto: CreateCategoryDto = {
      name: 'New Category',
      allowedSlugs: ['slug1', 'slug2'],
    };

    it('should throw BadRequestException if category with same name exists', async () => {
      const existingCategory = createCategory({ name: dto.name });
      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValue(existingCategory);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create category and return full details with slugs', async () => {
      const category = createCategory({ name: dto.name });
      const savedCategory = createCategory({ ...category, id: 1 });
      const fullCategory = createCategory({
        ...savedCategory,
        slugs: dto.allowedSlugs.map((slug) => createCategorySlug({ slug })),
        boards: [],
      });

      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fullCategory);
      categoryRepository.create = jest.fn().mockReturnValue(category);
      categoryRepository.save = jest.fn().mockResolvedValue(savedCategory);
      categorySlugRepository.create = jest
        .fn()
        .mockImplementation((data) => data as CategorySlug);
      categorySlugRepository.save = jest.fn();

      const result = await service.create(dto);

      expect(result.name).toBe(dto.name);
      expect(result.allowedSlugs).toEqual(dto.allowedSlugs);
      expect(result.boardIds).toEqual([]);
    });
  });

  describe('update', () => {
    const dto: UpdateCategoryDto = {
      name: 'Updated Name',
      allowedSlugs: ['new-slug'],
    };

    it('should update category and return full details with slugs', async () => {
      const originalCategory = createCategory({
        id: 1,
        name: 'Old Name',
        slugs: [createCategorySlug({ slug: 'old-slug' })],
        boards: [],
      });
      const updatedCategory = createCategory({
        id: 1,
        name: dto.name,
        slugs: dto.allowedSlugs.map((slug) => createCategorySlug({ slug })),
        boards: [],
      });

      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(originalCategory)
        .mockResolvedValueOnce(updatedCategory);
      categorySlugRepository.delete = jest.fn();
      categorySlugRepository.create = jest
        .fn()
        .mockImplementation((data) => data as CategorySlug);
      categorySlugRepository.save = jest.fn();
      categoryRepository.save = jest.fn().mockResolvedValue(undefined);

      const result = await service.update(1, dto);

      expect(result.name).toBe(dto.name);
      expect(result.allowedSlugs).toEqual(dto.allowedSlugs);
    });
  });

  describe('remove', () => {
    it('should delete category', async () => {
      const category = createCategory({
        id: 1,
        name: 'Test',
        slugs: [],
        boards: [],
      });
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(category);
      jest.spyOn(categoryRepository, 'remove').mockResolvedValue(undefined);

      await service.remove(1);
      expect(categoryRepository.remove).toHaveBeenCalledWith(category);
    });
  });

  describe('findOne', () => {
    it('should return category details', async () => {
      const category = createCategory({
        id: 1,
        name: 'Test',
        slugs: [{ id: 1, slug: 'slug', category: null }],
        boards: [
          createBoard({
            id: 100,
            slug: 'board',
            name: 'Board',
            category: null,
          }),
        ],
      });
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(category);

      const result = await service.findOne(1);
      expect(result).toEqual(category);
    });
  });

  describe('getCategoriesWithBoards', () => {
    it('보드를 목적별로 그룹화하여 반환해야 함', async () => {
      // 테스트 데이터 구성
      const mockCategory = createCategory({
        name: '공지사항',
        boards: [
          createBoard({
            id: 1,
            slug: 'notice-board',
            name: '공지게시판',
            type: BoardPurpose.GENERAL,
          }),
          createBoard({
            id: 2,
            slug: 'faq-board',
            name: 'FAQ',
            type: BoardPurpose.GENERAL,
          }),
          createBoard({
            id: 3,
            slug: 'LOG',
            name: 'LOG',
            type: BoardPurpose.AI_DIGEST,
          }),
        ],
      });

      // Repository mock 설정
      categoryRepository.find = jest.fn().mockResolvedValue([mockCategory]);

      // 실행 및 검증
      const result = await service.getCategoriesWithBoards();

      expect(result).toEqual([
        {
          name: '공지사항',
          boardGroups: [
            {
              purpose: BoardPurpose.GENERAL,
              boards: [
                { id: 1, slug: 'notice-board', name: '공지게시판' },
                { id: 2, slug: 'faq-board', name: 'FAQ' },
              ],
            },
            {
              purpose: BoardPurpose.AI_DIGEST,
              boards: [
                {
                  id: 3,
                  slug: 'LOG',
                  name: 'LOG',
                },
              ],
            },
          ],
        },
      ]);
    });
  });
});
