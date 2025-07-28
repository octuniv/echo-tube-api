import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service';
import { Board, BoardPurpose } from './entities/board.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { createBoard } from './factories/board.factory';
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BoardListItemDto } from './dto/list/board-list-item.dto';
import { CategoriesService } from '@/categories/categories.service';
import { UpdateBoardDto } from '../admin/board/dto/CRUD/update-board.dto';
import { ScrapingTargetBoardDto } from './dto/scraping/scraping-target-board.dto';
import { BOARD_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('BoardsService', () => {
  let service: BoardsService;
  let boardRepository: Repository<Board>;
  let categoriesService: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        {
          provide: getRepositoryToken(Board),
          useValue: createMock<Repository<Board>>(),
        },
        {
          provide: CategoriesService,
          useValue: {
            validateSlugWithinCategory: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BoardsService);
    boardRepository = module.get(getRepositoryToken(Board));
    categoriesService = module.get(CategoriesService);
  });

  beforeAll(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return boards ordered by category and name ASC', async () => {
      const mockBoards = [
        createBoard({
          id: 2,
          name: 'Board B',
          category: createCategory({ id: 1 }),
        }),
        createBoard({
          id: 1,
          name: 'Board A',
          category: createCategory({ id: 1 }),
        }),
        createBoard({
          id: 3,
          name: 'Board C',
          category: createCategory({ id: 2 }),
        }),
      ];

      (boardRepository.find as jest.Mock).mockResolvedValue(mockBoards);

      const result = await service.findAll();
      expect(result).toEqual(mockBoards);
      expect(boardRepository.find).toHaveBeenCalledWith({
        relations: ['category', 'categorySlug'],
        order: { category: { name: 'ASC' }, name: 'ASC' },
      });
    });
  });

  describe('findAllForList', () => {
    it('should return board list items with category and ordered by category.name and board.name', async () => {
      const mockBoards = [
        createBoard({
          id: 1,
          name: 'Board A',
          category: createCategory({ id: 1, name: 'Category 1' }),
          categorySlug: createCategorySlug({ slug: 'board-a' }),
          requiredRole: UserRole.USER,
          type: BoardPurpose.GENERAL,
        }),
        createBoard({
          id: 2,
          name: 'Board B',
          category: createCategory({ id: 1, name: 'Category 1' }),
          categorySlug: createCategorySlug({ slug: 'board-b' }),
          requiredRole: UserRole.ADMIN,
          type: BoardPurpose.GENERAL,
        }),
        createBoard({
          id: 3,
          name: 'Board C',
          category: createCategory({ id: 2, name: 'Category 2' }),
          categorySlug: createCategorySlug({ slug: 'board-c' }),
          requiredRole: UserRole.BOT,
          type: BoardPurpose.AI_DIGEST,
        }),
      ];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockBoards),
      };

      jest
        .spyOn(boardRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const result = await service.findAllForList();

      expect(result).toEqual(mockBoards.map(BoardListItemDto.fromEntity));
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'board.category',
        'category',
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'board.categorySlug',
        'categorySlug',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('category.name', 'ASC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('board.name', 'ASC');
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should return empty array when no boards exist', async () => {
      // 빈 배열 반환
      jest.spyOn(boardRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.findAllForList();
      expect(result).toEqual([]);
    });
  });

  describe('findOneBySlug', () => {
    it('should return board with requiredRole information', async () => {
      const testCategorySlug = createCategorySlug({ slug: 'test-slug' });

      const testCategory = createCategory({
        id: 1,
        slugs: [testCategorySlug],
      });

      const testBoard = createBoard({
        id: 1,
        categorySlug: createCategorySlug({ slug: 'test-slug' }),
        name: 'Test Board',
        description: 'Test Description',
        requiredRole: UserRole.ADMIN,
        category: testCategory,
      });

      (boardRepository.findOne as jest.Mock).mockResolvedValue(testBoard);

      const result = await service.findOneBySlug('test-slug');

      expect(result).toEqual(testBoard);

      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { categorySlug: { slug: 'test-slug' } },
        relations: ['category', 'categorySlug'],
      });
    });

    it('should throw NotFoundException when board not found', async () => {
      (boardRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOneBySlug('non-exist-slug')).rejects.toThrow(
        new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
      );
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { categorySlug: { slug: 'non-exist-slug' } },
        relations: ['category', 'categorySlug'],
      });
    });
  });

  describe('getScrapingTargetBoards', () => {
    it('should return boards with AI_DIGEST type', async () => {
      const mockVideoBoards = [
        createBoard({
          categorySlug: createCategorySlug({ slug: 'video-board-1' }),
          name: 'Video Board 1',
          type: BoardPurpose.AI_DIGEST,
        }),
        createBoard({
          categorySlug: createCategorySlug({ slug: 'video-board-2' }),
          name: 'Video Board 2',
          type: BoardPurpose.AI_DIGEST,
        }),
      ];

      jest.spyOn(boardRepository, 'find').mockResolvedValue(mockVideoBoards);

      const result = await service.getScrapingTargetBoards();

      expect(result).toEqual(
        mockVideoBoards.map((video) =>
          ScrapingTargetBoardDto.fromEntity(video),
        ),
      );
      expect(boardRepository.find).toHaveBeenCalledWith({
        where: { type: BoardPurpose.AI_DIGEST },
        relations: ['categorySlug'],
      });
    });
  });

  describe('findOne', () => {
    it('should return a board with category when found', async () => {
      const board = createBoard({ id: 1, category: createCategory({ id: 1 }) });
      (boardRepository.findOne as jest.Mock).mockResolvedValue(board);

      const result = await service.findOne(1);
      expect(result).toEqual(board);
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category', 'categorySlug'],
      });
    });

    it('should throw NotFoundException when board not found', async () => {
      (boardRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
      );
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
        relations: ['category', 'categorySlug'],
      });
    });
  });

  describe('create', () => {
    it('should create a board with category', async () => {
      const dto = {
        slug: 'new-board',
        name: 'New Board',
        description: 'New Description',
        requiredRole: UserRole.USER,
        type: BoardPurpose.GENERAL,
        categoryId: 1,
      };
      const categorySlug = createCategorySlug({ slug: 'new-board' });
      const category = createCategory({
        id: 1,
      });
      categorySlug.category = category;
      const createdBoard = createBoard({ ...dto, category, categorySlug });

      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(categorySlug);
      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(boardRepository, 'create').mockReturnValue(createdBoard);
      jest.spyOn(boardRepository, 'save').mockResolvedValue(createdBoard);

      const result = await service.create(dto);
      expect(result).toEqual(createdBoard);

      expect(boardRepository.create).toHaveBeenCalledWith({
        name: dto.name,
        description: dto.description,
        requiredRole: dto.requiredRole,
        type: dto.type,
        category,
        categorySlug,
      });
      expect(boardRepository.save).toHaveBeenCalledWith(createdBoard);
    });

    it('should throw BadRequestException if categorySlug not found or not allowed', async () => {
      const dto = {
        slug: 'new-board',
        name: 'New Board',
        categoryId: 999,
      };

      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockRejectedValue(
          new BadRequestException(
            BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(dto.slug),
          ),
        );

      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException(
          BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(dto.slug),
        ),
      );
    });

    it('should throw BadRequestException if AI_DIGEST board has USER role', async () => {
      const dto = {
        slug: 'ai-board',
        name: 'AI Board',
        requiredRole: UserRole.USER,
        type: BoardPurpose.AI_DIGEST,
        categoryId: 1,
      };
      const categorySlug = createCategorySlug({ slug: dto.slug });
      const category = createCategory({
        id: 1,
      });
      categorySlug.category = category;
      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(categorySlug);
      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(boardRepository, 'create').mockReturnValue(
        createBoard({
          categorySlug,
          name: dto.name,
          requiredRole: dto.requiredRole,
          type: dto.type,
          ...category,
        }),
      );
      await expect(service.create(dto)).rejects.toThrow(
        BOARD_ERROR_MESSAGES.AI_DIGEST_REQUIRES_HIGHER_ROLE,
      );
    });

    it('should allow AI_DIGEST board with ADMIN role', async () => {
      const dto = {
        slug: 'ai-board',
        name: 'AI Board',
        requiredRole: UserRole.ADMIN,
        type: BoardPurpose.AI_DIGEST,
        categoryId: 1,
      };
      const categorySlug = createCategorySlug({ slug: dto.slug });
      const category = createCategory({
        id: 1,
      });
      categorySlug.category = category;

      const createdBoard = createBoard({ ...dto, category, categorySlug });
      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(categorySlug);
      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(boardRepository, 'create').mockReturnValue(createdBoard);
      jest.spyOn(boardRepository, 'save').mockResolvedValue(createdBoard);
      const result = await service.create(dto);
      expect(result).toEqual(createdBoard);
    });

    it('should throw BadRequestException if slug is already in use', async () => {
      const dto = {
        slug: 'duplicate-slug',
        name: 'Test Board',
        categoryId: 1,
      };
      const categorySlug = createCategorySlug({ slug: dto.slug });
      const existingBoard = createBoard({
        id: 999,
        categorySlug,
      });

      // 중복된 slug 존재
      (boardRepository.findOne as jest.Mock).mockImplementation((options) => {
        if (options.where.categorySlug?.slug === dto.slug) {
          return Promise.resolve(existingBoard);
        }
        return Promise.resolve(null);
      });

      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(categorySlug);

      await expect(service.create(dto)).rejects.toThrow(
        BOARD_ERROR_MESSAGES.DUPLICATE_SLUG(dto.slug),
      );
    });
  });

  describe('update', () => {
    it('should update board properties', async () => {
      const oldSlug = createCategorySlug({ slug: 'old-slug' });
      const existingBoard = createBoard({
        id: 1,
        categorySlug: oldSlug,
      });
      const dto = {
        slug: 'updated-slug',
        name: 'Updated Board',
        description: 'Updated Description',
        requiredRole: UserRole.ADMIN,
        type: BoardPurpose.AI_DIGEST,
        categoryId: 2,
      } satisfies UpdateBoardDto;
      const newSlug = createCategorySlug({ slug: 'updated-slug' });
      const updatedCategory = createCategory({
        id: 2,
      });
      oldSlug.category = updatedCategory;
      newSlug.category = updatedCategory;

      jest
        .spyOn(boardRepository, 'findOne')
        .mockResolvedValueOnce(existingBoard)
        .mockResolvedValueOnce(null);
      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(newSlug);
      jest.spyOn(boardRepository, 'save').mockResolvedValue({
        ...existingBoard,
        categorySlug: newSlug,
        name: dto.name,
        description: dto.description,
        requiredRole: dto.requiredRole,
        type: dto.type,
        category: updatedCategory,
        categoryId: dto.categoryId,
      } as any);

      const result = await service.update(1, dto);
      expect(result).toEqual({
        ...existingBoard,
        name: dto.name,
        description: dto.description,
        requiredRole: dto.requiredRole,
        type: dto.type,
        category: updatedCategory,
        categoryId: updatedCategory.id,
        categorySlug: newSlug,
      });
    });

    it('should throw NotFoundException if board not found', async () => {
      jest
        .spyOn(boardRepository, 'findOne')
        .mockRejectedValue(
          new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
        );

      await expect(
        service.update(999, {
          slug: '',
          name: '',
          categoryId: 0,
        }),
      ).rejects.toThrow(
        new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
      );
    });

    it('should throw BadRequestException if slug is not allowed in new category', async () => {
      const oldSlug = createCategorySlug({ slug: 'old-slug' });
      const existingBoard = createBoard({ id: 1, categorySlug: oldSlug });
      const dto = {
        slug: 'invalid-slug',
        name: 'Updated Board',
        categoryId: 2,
      };

      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(existingBoard);
      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockRejectedValue(
          new BadRequestException(
            BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(dto.slug),
          ),
        );

      await expect(service.update(1, dto)).rejects.toThrow(
        new BadRequestException(
          BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(dto.slug),
        ),
      );
    });

    it('should throw BadRequestException if updating to AI_DIGEST with USER role', async () => {
      const existingBoard = createBoard({
        id: 1,
        type: BoardPurpose.GENERAL,
        requiredRole: UserRole.ADMIN,
      });
      const dto = {
        slug: 'test',
        type: BoardPurpose.AI_DIGEST,
        requiredRole: UserRole.USER,
      } as UpdateBoardDto;

      const categorySlug = createCategorySlug({ slug: dto.slug });
      const category = createCategory({
        id: 2,
      });
      categorySlug.category = category;
      jest
        .spyOn(boardRepository, 'findOne')
        .mockResolvedValueOnce(existingBoard)
        .mockResolvedValueOnce(null);
      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(categorySlug);
      await expect(service.update(1, dto)).rejects.toThrow(
        BOARD_ERROR_MESSAGES.AI_DIGEST_REQUIRES_HIGHER_ROLE,
      );
    });

    it('should allow updating to AI_DIGEST with ADMIN role', async () => {
      const existingBoard = createBoard({
        id: 1,
        type: BoardPurpose.GENERAL,
        requiredRole: UserRole.ADMIN,
      });
      const dto = {
        slug: 'test',
        type: BoardPurpose.AI_DIGEST,
        requiredRole: UserRole.ADMIN,
      } as UpdateBoardDto;
      const categorySlug = createCategorySlug({ slug: dto.slug });
      const category = createCategory({
        id: 2,
      });
      categorySlug.category = category;
      const updatedBoard = { ...existingBoard, ...dto };
      jest
        .spyOn(boardRepository, 'findOne')
        .mockResolvedValueOnce(existingBoard)
        .mockResolvedValueOnce(null);
      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(categorySlug);
      jest
        .spyOn(boardRepository, 'save')
        .mockResolvedValue(updatedBoard as any);
      const result = await service.update(1, dto);
      expect(result.type).toBe(BoardPurpose.AI_DIGEST);
      expect(result.requiredRole).toBe(UserRole.ADMIN);
    });

    it('should throw BadRequestException when updating to a duplicate slug', async () => {
      const oldSlug = createCategorySlug({ slug: 'old-slug' });
      const duplicateSlug = createCategorySlug({ slug: 'duplicate-slug' });
      const existingBoard = createBoard({ id: 1, categorySlug: oldSlug });
      const dto = {
        slug: 'duplicate-slug',
        name: 'Updated Board',
        categoryId: 1,
      } satisfies UpdateBoardDto;
      const category = createCategory({
        id: 1,
      });
      duplicateSlug.category = category;
      const duplicateBoard = createBoard({
        id: 2,
        categorySlug: duplicateSlug,
      });

      jest.spyOn(boardRepository, 'findOne').mockImplementation((options) => {
        const where = options.where as any;
        if (where.slug === dto.slug && where.id?.not === existingBoard.id) {
          return Promise.resolve(duplicateBoard);
        }
        return Promise.resolve(existingBoard);
      });

      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(duplicateSlug);

      await expect(service.update(1, dto)).rejects.toThrow(
        BOARD_ERROR_MESSAGES.DUPLICATE_SLUG(dto.slug),
      );
    });

    it('should allow updating with the same slug', async () => {
      const sameSlug = createCategorySlug({ slug: 'same-slug' });
      const existingBoard = createBoard({ id: 1, categorySlug: sameSlug });
      const dto = {
        slug: 'same-slug',
        name: 'Updated Board',
        categoryId: 1,
      } satisfies UpdateBoardDto;
      const category = createCategory({
        id: 1,
      });
      sameSlug.category = category;

      jest.spyOn(boardRepository, 'findOne').mockImplementation((options) => {
        const where = options.where as any;

        // 1. id로 조회: 기존 게시판 반환
        if (where.id === existingBoard.id) {
          return Promise.resolve(existingBoard);
        }

        // 2. slug + id != excludeId: 중복 없음
        if (where.slug === dto.slug && where.id?.not === existingBoard.id) {
          return Promise.resolve(null);
        }

        // 3. 그 외: 기본 null 반환
        return Promise.resolve(null);
      });

      jest
        .spyOn(categoriesService, 'validateSlugWithinCategory')
        .mockResolvedValue(sameSlug);
      jest.spyOn(boardRepository, 'save').mockResolvedValue({
        ...existingBoard,
        ...dto,
        category,
      });

      const result = await service.update(1, dto);
      expect(result.categorySlug.slug).toBe(dto.slug);
    });
  });

  describe('remove', () => {
    it('should delete a board successfully', async () => {
      jest
        .spyOn(boardRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(boardRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if board not found', async () => {
      jest
        .spyOn(boardRepository, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      await expect(service.remove(999)).rejects.toThrow(
        new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
      );
      expect(boardRepository.delete).toHaveBeenCalledWith(999);
    });
  });
});
