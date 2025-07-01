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
import { In, Not, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from './dto/CRUD/update-category.dto';
import { createBoard } from '@/boards/factories/board.factory';
import { BoardPurpose } from '@/boards/entities/board.entity';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: Repository<Category>;
  let categorySlugRepository: Repository<CategorySlug>;

  const mockCategoryName = 'Test Category';
  const mockSlugs = ['valid-slug-1', 'valid-slug-2'];
  const mockCategory = createCategory({
    name: mockCategoryName,
    slugs: mockSlugs.map((slug) => createCategorySlug({ slug })),
  });

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

  describe('findSlugsByCategory', () => {
    it('존재하는 카테고리의 슬러그 목록 반환', async () => {
      categoryRepository.findOne = jest.fn().mockResolvedValue(mockCategory);

      const result = await service.findSlugsByCategory(mockCategoryName);
      expect(result).toEqual(mockSlugs);
    });

    it('존재하지 않는 카테고리인 경우 빈 배열 반환', async () => {
      categoryRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.findSlugsByCategory('non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('listAllCategoriesWithSlugs', () => {
    it('모든 카테고리와 슬러그 목록을 반환해야 함', async () => {
      const mockCategories = [
        createCategory({
          name: '공지사항',
          slugs: ['announcements', 'notices'].map((slug) =>
            createCategorySlug({ slug }),
          ),
        }),
        createCategory({
          name: '커뮤니티',
          slugs: ['free', 'humor', 'qna'].map((slug) =>
            createCategorySlug({ slug }),
          ),
        }),
      ];

      categoryRepository.find = jest.fn().mockResolvedValue(mockCategories);
      const result = await service.listAllCategoriesWithSlugs();

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

    it('카테고리가 없는 경우 빈 배열을 반환해야 함', async () => {
      categoryRepository.find = jest.fn().mockResolvedValue([]);
      const result = await service.listAllCategoriesWithSlugs();
      expect(result).toEqual([]);
    });
  });

  describe('verifySlugBelongsToCategory', () => {
    it('유효한 슬러그인 경우 정상 처리', async () => {
      categoryRepository.findOne = jest.fn().mockResolvedValue(mockCategory);

      await expect(
        service.verifySlugBelongsToCategory(mockCategoryName, mockSlugs[0]),
      ).resolves.not.toThrow();
    });

    it('유효하지 않은 슬러그인 경우 에러 발생', async () => {
      const mockCategory = createCategory({
        name: mockCategoryName,
        slugs: mockSlugs.map((slug) => createCategorySlug({ slug })),
      });

      categoryRepository.findOne = jest.fn().mockResolvedValue(mockCategory);

      await expect(
        service.verifySlugBelongsToCategory(mockCategoryName, 'invalid-slug'),
      ).rejects.toThrow(BadRequestException);
    });

    it('존재하지 않는 카테고리인 경우 에러 발생', async () => {
      categoryRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.verifySlugBelongsToCategory('non-existent', 'slug'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('isSlugUsedInOtherCategory', () => {
    it('다른 카테고리에 슬러그가 존재하는 경우 true 반환', async () => {
      const mockSlug = 'existing-slug';
      const mockOtherCategory = createCategory({ id: 2 });
      categorySlugRepository.findOne = jest
        .fn()
        .mockResolvedValue(
          createCategorySlug({ slug: mockSlug, category: mockOtherCategory }),
        );
      const result = await service.isSlugUsedInOtherCategory(mockSlug, 1);
      expect(result).toBe(true);
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

      const result = await service.listAllCategoriesWithSlugs();
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
      const result = await service.listAllCategoriesWithSlugs();
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const dto: CreateCategoryDto = {
      name: 'New Category',
      allowedSlugs: ['slug1', 'slug2'],
    };

    it('동일한 이름의 카테고리가 존재하는 경우 BadRequestException을 던져야 함', async () => {
      const existingCategory = createCategory({ name: dto.name });
      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValue(existingCategory);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { name: dto.name },
      });
    });

    it('슬러그가 이미 다른 카테고리에 사용 중인 경우 BadRequestException을 던져야 함', async () => {
      const existingSlug = 'slug1';
      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      categorySlugRepository.findOne = jest
        .fn()
        .mockResolvedValue(createCategorySlug({ slug: existingSlug }));

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(categorySlugRepository.findOne).toHaveBeenCalledWith({
        where: { slug: existingSlug },
      });
    });

    it('카테고리와 슬러그를 성공적으로 생성하고 상세 정보를 반환해야 함', async () => {
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
      categorySlugRepository.findOne = jest.fn(() => null);
      categorySlugRepository.save = jest.fn();

      const result = await service.create(dto);

      expect(result.name).toBe(dto.name);
      expect(result.allowedSlugs).toEqual(dto.allowedSlugs);
      expect(result.boardIds).toEqual([]);
      expect(categoryRepository.create).toHaveBeenCalledWith({
        name: dto.name,
      });
      expect(categoryRepository.save).toHaveBeenCalledWith(category);
      expect(categorySlugRepository.create).toHaveBeenCalledTimes(
        dto.allowedSlugs.length,
      );
      expect(categorySlugRepository.save).toHaveBeenCalledWith(
        expect.any(Array),
      );
    });

    it('빈 슬러그 배열이 제공된 경우 BadRequestException을 던져야 함', async () => {
      const dtoWithEmptySlugs: CreateCategoryDto = {
        ...dto,
        allowedSlugs: [],
      };

      await expect(service.create(dtoWithEmptySlugs)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('기존 슬러그를 유지하고 새 슬러그를 추가할 수 있어야 함', async () => {
      const EXISTED_SLUG = 'duplicated-slug';
      const NEW_SLUG = 'new-slug';

      const existedCategorySlug = createCategorySlug({ slug: EXISTED_SLUG });
      const newCategorySlug = createCategorySlug({ slug: NEW_SLUG });

      const dto: UpdateCategoryDto = {
        name: 'Updated Name',
        allowedSlugs: [EXISTED_SLUG, NEW_SLUG],
      };

      const currentCategory = createCategory({
        id: 1,
        name: 'Old Name',
        slugs: [existedCategorySlug],
        boards: [],
      });

      const updatedCategory = createCategory({
        id: 1,
        name: dto.name,
        slugs: [existedCategorySlug, newCategorySlug],
        boards: [],
      });

      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(currentCategory)
        .mockResolvedValueOnce(updatedCategory);

      categorySlugRepository.find = jest.fn().mockResolvedValue([]);

      categorySlugRepository.remove = jest.fn();
      categorySlugRepository.create = jest
        .fn()
        .mockImplementation((data) => ({ ...data, id: 999 }));
      categorySlugRepository.save = jest
        .fn()
        .mockResolvedValue([newCategorySlug]);

      const result = await service.update(1, dto);

      expect(result.name).toBe(dto.name);
      expect(result.allowedSlugs).toContain(EXISTED_SLUG);
      expect(result.allowedSlugs).toContain(NEW_SLUG);
      expect(categorySlugRepository.remove).toHaveBeenCalledWith([]);
      expect(categorySlugRepository.create).toHaveBeenCalledWith({
        slug: NEW_SLUG,
        category: currentCategory,
      });
      expect(categorySlugRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ slug: NEW_SLUG }),
      ]);
    });

    it('기존 슬러그 삭제 및 새 슬러그 추가 시 정상 동작해야 함', async () => {
      const OLD_SLUG = 'old-slug';
      const NEW_SLUG = 'new-slug';

      const oldSlugEntity = createCategorySlug({ slug: OLD_SLUG });
      const newSlugEntity = createCategorySlug({ slug: NEW_SLUG });

      const dto: UpdateCategoryDto = {
        name: 'Updated Name',
        allowedSlugs: [NEW_SLUG],
      };

      const currentCategory = createCategory({
        id: 1,
        name: 'Old Name',
        slugs: [oldSlugEntity],
        boards: [],
      });

      const updatedCategory = createCategory({
        id: 1,
        name: dto.name,
        slugs: [newSlugEntity],
        boards: [],
      });

      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(currentCategory)
        .mockResolvedValueOnce(updatedCategory);

      categorySlugRepository.find = jest.fn().mockResolvedValue([]);
      categorySlugRepository.remove = jest.fn().mockResolvedValue(undefined);
      categorySlugRepository.create = jest
        .fn()
        .mockImplementation((data) => ({ ...data, id: 999 }));
      categorySlugRepository.save = jest
        .fn()
        .mockResolvedValue([newSlugEntity]);

      categoryRepository.save = jest.fn().mockResolvedValue(undefined);

      const result = await service.update(1, dto);

      expect(result.name).toBe(dto.name);
      expect(result.allowedSlugs).not.toContain(OLD_SLUG);
      expect(result.allowedSlugs).toContain(NEW_SLUG);
      expect(categorySlugRepository.remove).toHaveBeenCalledWith([
        oldSlugEntity,
      ]);
      expect(categorySlugRepository.create).toHaveBeenCalledWith({
        slug: NEW_SLUG,
        category: currentCategory,
      });
      expect(categorySlugRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ slug: NEW_SLUG }),
      ]);
    });

    it('다른 카테고리에 동일한 슬러그가 존재하면 BadRequestException 발생', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated Name',
        allowedSlugs: ['duplicate-slug'],
      };

      const currentCategory = createCategory({
        id: 1,
        name: 'Current Category',
        slugs: [],
      });

      const duplicateSlug = createCategorySlug({
        slug: 'duplicate-slug',
        category: createCategory({ id: 2, name: 'Other Category' }),
      });

      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(currentCategory);
      categorySlugRepository.find = jest
        .fn()
        .mockResolvedValue([duplicateSlug]);

      await expect(service.update(1, dto)).rejects.toThrow(BadRequestException);
      expect(categorySlugRepository.find).toHaveBeenCalledWith({
        where: {
          slug: In(dto.allowedSlugs),
          category: { id: Not(1) },
        },
      });
    });

    it('빈 슬러그 배열 제공 시 BadRequestException 발생', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated Name',
        allowedSlugs: [],
      };

      const currentCategory = createCategory({
        id: 1,
        name: 'Current Category',
        slugs: [],
      });

      categoryRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(currentCategory);

      await expect(service.update(1, dto)).rejects.toThrow(BadRequestException);
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
