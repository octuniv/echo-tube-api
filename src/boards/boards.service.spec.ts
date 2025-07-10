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
import {
  BOARD_ERROR_MESSAGES,
  CATEGORY_ERROR_MESSAGES,
} from '@/common/constants/error-messages.constants';

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
            findOne: jest.fn(),
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
        relations: ['category'],
        order: { category: { name: 'ASC' }, name: 'ASC' },
      });
    });
  });

  describe('findAllForList', () => {
    it('should return board list items with requiredRole and proper ordering', async () => {
      const mockBoards = [
        createBoard({
          id: 1,
          slug: 'board-a',
          name: 'Board A',
          description: 'Description A',
          requiredRole: UserRole.USER,
          category: createCategory({ id: 1, name: 'Category 1' }),
        }),
        createBoard({
          id: 2,
          slug: 'board-b',
          name: 'Board B',
          description: 'Description B',
          requiredRole: UserRole.ADMIN,
          category: createCategory({ id: 2, name: 'Category 2' }),
        }),
        createBoard({
          id: 3,
          slug: 'externalWriter',
          name: 'externalWriter',
          description: 'Description C',
          requiredRole: UserRole.BOT,
          category: createCategory({ id: 3, name: 'Category 3' }),
          type: BoardPurpose.AI_DIGEST,
        }),
      ];

      (boardRepository.find as jest.Mock).mockResolvedValue(mockBoards);

      const result = await service.findAllForList();

      expect(result).toEqual([
        {
          id: 1,
          slug: 'board-a',
          name: 'Board A',
          description: 'Description A',
          requiredRole: UserRole.USER,
          boardType: BoardPurpose.GENERAL,
        },
        {
          id: 2,
          slug: 'board-b',
          name: 'Board B',
          description: 'Description B',
          requiredRole: UserRole.ADMIN,
          boardType: BoardPurpose.GENERAL,
        },
        {
          id: 3,
          slug: 'externalWriter',
          name: 'externalWriter',
          description: 'Description C',
          requiredRole: UserRole.BOT,
          boardType: BoardPurpose.AI_DIGEST,
        },
      ] satisfies BoardListItemDto[]);

      expect(boardRepository.find).toHaveBeenCalledWith({
        order: { category: { name: 'ASC' }, name: 'ASC' },
      });
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
        slug: 'test-slug',
        name: 'Test Board',
        description: 'Test Description',
        requiredRole: UserRole.ADMIN,
        category: testCategory,
      });

      (boardRepository.findOne as jest.Mock).mockResolvedValue(testBoard);

      const result = await service.findOneBySlug('test-slug');

      expect(result).toEqual(testBoard);

      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-slug' },
        relations: ['category'],
      });
    });

    it('should throw NotFoundException when board not found', async () => {
      (boardRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOneBySlug('non-exist-slug')).rejects.toThrow(
        new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
      );
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'non-exist-slug' },
        relations: ['category'],
      });
    });
  });

  describe('getVideoBoards', () => {
    it('should return boards with AI_DIGEST type', async () => {
      const mockVideoBoards = [
        createBoard({
          slug: 'video-board-1',
          name: 'Video Board 1',
          type: BoardPurpose.AI_DIGEST,
        }),
        createBoard({
          slug: 'video-board-2',
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
        select: ['slug', 'name'],
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
        relations: ['category'],
      });
    });

    it('should throw NotFoundException when board not found', async () => {
      (boardRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
      );
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
        relations: ['category'],
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
      const category = createCategory({
        id: 1,
        slugs: [createCategorySlug({ slug: 'new-board' })],
      });
      const createdBoard = createBoard({ ...dto, category });

      jest.spyOn(categoriesService, 'findOne').mockResolvedValue(category);
      jest.spyOn(boardRepository, 'create').mockReturnValue(createdBoard);
      jest.spyOn(boardRepository, 'save').mockResolvedValue(createdBoard);

      const result = await service.create(dto);
      expect(result).toEqual(createdBoard);
      expect(categoriesService.findOne).toHaveBeenCalledWith(1);
      expect(boardRepository.create).toHaveBeenCalledWith({
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        requiredRole: dto.requiredRole,
        type: dto.type,
        category,
      });
      expect(boardRepository.save).toHaveBeenCalledWith(createdBoard);
    });

    it('should throw NotFoundException if category not found', async () => {
      const dto = {
        slug: 'new-board',
        name: 'New Board',
        categoryId: 999,
      };

      jest
        .spyOn(categoriesService, 'findOne')
        .mockRejectedValue(
          new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND),
        );

      await expect(service.create(dto)).rejects.toThrow(
        new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND),
      );
    });

    it('should throw BadRequestException if slug is not allowed in category', async () => {
      const dto = {
        slug: 'invalid-slug',
        name: 'Test Board',
        categoryId: 1,
      };
      const category = createCategory({ id: 1, slugs: [] }); // No allowed slugs

      jest.spyOn(categoriesService, 'findOne').mockResolvedValue(category);

      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException(
          BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(dto.slug),
        ),
      );
      expect(categoriesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw BadRequestException if AI_DIGEST board has USER role', async () => {
      const dto = {
        slug: 'ai-board',
        name: 'AI Board',
        requiredRole: UserRole.USER,
        type: BoardPurpose.AI_DIGEST,
        categoryId: 1,
      };
      const category = createCategory({
        id: 1,
        slugs: [createCategorySlug({ slug: dto.slug })],
      });
      jest.spyOn(categoriesService, 'findOne').mockResolvedValue(category);
      jest.spyOn(boardRepository, 'create').mockReturnValue(
        createBoard({
          slug: dto.slug,
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
      const category = createCategory({
        id: 1,
        slugs: [createCategorySlug({ slug: dto.slug })],
      });
      const createdBoard = createBoard({ ...dto, category });
      jest.spyOn(categoriesService, 'findOne').mockResolvedValue(category);
      jest.spyOn(boardRepository, 'create').mockReturnValue(createdBoard);
      jest.spyOn(boardRepository, 'save').mockResolvedValue(createdBoard);
      const result = await service.create(dto);
      expect(result).toEqual(createdBoard);
    });
  });

  describe('update', () => {
    it('should update board properties', async () => {
      const existingBoard = createBoard({ id: 1, slug: 'old-slug' });
      const dto = {
        slug: 'updated-slug',
        name: 'Updated Board',
        description: 'Updated Description',
        requiredRole: UserRole.ADMIN,
        type: BoardPurpose.AI_DIGEST,
        categoryId: 2,
      } satisfies UpdateBoardDto;
      const updatedCategory = createCategory({
        id: 2,
        slugs: [
          createCategorySlug({ slug: 'old-slug' }),
          createCategorySlug({ slug: 'updated-slug' }),
        ],
      });

      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(existingBoard);
      jest
        .spyOn(categoriesService, 'findOne')
        .mockResolvedValue(updatedCategory);
      jest.spyOn(boardRepository, 'save').mockResolvedValue({
        ...existingBoard,
        slug: dto.slug,
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
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        requiredRole: dto.requiredRole,
        type: dto.type,
        category: updatedCategory,
      });
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
      expect(categoriesService.findOne).toHaveBeenCalledWith(2);
      expect(boardRepository.save).toHaveBeenCalledWith({
        ...existingBoard,
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        requiredRole: dto.requiredRole,
        type: dto.type,
        category: updatedCategory,
      });
    });

    it('should throw NotFoundException if board not found', async () => {
      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(null);

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

    it('should update board without changing category if categoryId is unchanged', async () => {
      const existingCategory = createCategory({
        id: 1,
        slugs: [createCategorySlug({ slug: 'old-slug' })],
      });
      const existingBoard = createBoard({
        id: 1,
        slug: 'old-slug',
        category: existingCategory,
      });

      const dto = {
        name: 'Updated Name',
        slug: existingBoard.slug,
        categoryId: existingCategory.id,
      } satisfies UpdateBoardDto;

      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(existingBoard);
      jest
        .spyOn(categoriesService, 'findOne')
        .mockResolvedValue(existingCategory);
      jest.spyOn(boardRepository, 'save').mockResolvedValue({
        ...existingBoard,
        ...dto,
        category: existingCategory,
      } as any);

      const result = await service.update(1, dto);

      expect(result).toEqual({
        ...existingBoard,
        name: dto.name,
        slug: dto.slug,
        category: existingCategory,
      });

      expect(categoriesService.findOne).toHaveBeenCalledWith(
        existingCategory.id,
      );
      expect(boardRepository.save).toHaveBeenCalledWith({
        ...existingBoard,
        name: dto.name,
        slug: dto.slug,
        category: existingCategory,
      });
    });

    it('should throw BadRequestException if slug is not allowed in new category', async () => {
      const existingBoard = createBoard({ id: 1, slug: 'old-slug' });
      const dto = {
        slug: 'invalid-slug',
        name: 'Updated Board',
        categoryId: 2,
      };
      const category = createCategory({ id: 2, slugs: [] }); // No allowed slugs

      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(existingBoard);
      jest.spyOn(categoriesService, 'findOne').mockResolvedValue(category);

      await expect(service.update(1, dto)).rejects.toThrow(
        new BadRequestException(
          BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(dto.slug),
        ),
      );
      expect(categoriesService.findOne).toHaveBeenCalledWith(2);
    });

    it('should throw BadRequestException if updating to AI_DIGEST with USER role', async () => {
      const existingBoard = createBoard({
        id: 1,
        type: BoardPurpose.GENERAL,
        requiredRole: UserRole.ADMIN,
      });
      const dto = {
        type: BoardPurpose.AI_DIGEST,
        requiredRole: UserRole.USER,
      } as UpdateBoardDto;
      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(existingBoard);
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
        type: BoardPurpose.AI_DIGEST,
        requiredRole: UserRole.ADMIN,
      } as UpdateBoardDto;
      const updatedBoard = { ...existingBoard, ...dto };
      jest.spyOn(boardRepository, 'findOne').mockResolvedValue(existingBoard);
      jest
        .spyOn(boardRepository, 'save')
        .mockResolvedValue(updatedBoard as any);
      const result = await service.update(1, dto);
      expect(result.type).toBe(BoardPurpose.AI_DIGEST);
      expect(result.requiredRole).toBe(UserRole.ADMIN);
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
