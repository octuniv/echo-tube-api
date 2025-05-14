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
import { NotFoundException } from '@nestjs/common';
import { ScrapingTargetBoardDto } from './dto/scraping-target-board.dto';
import { BoardListItemDto } from './dto/board-list-item.dto';

describe('BoardsService', () => {
  let service: BoardsService;
  let boardRepository: Repository<Board>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        {
          provide: getRepositoryToken(Board),
          useValue: createMock<Repository<Board>>(),
        },
      ],
    }).compile();

    service = module.get(BoardsService);
    boardRepository = module.get(getRepositoryToken(Board));
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
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          requiredRole: true,
          type: true,
        },
        order: { category: { name: 'ASC' }, name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
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

      const result = await service.findOne('test-slug');

      expect(result).toEqual(testBoard);

      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-slug' },
        relations: ['category'],
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          requiredRole: true,
          category: { id: true, name: true },
        },
      });
    });

    it('should throw NotFoundException when board not found', async () => {
      (boardRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-exist-slug')).rejects.toThrow(
        new NotFoundException('게시판을 찾을 수 없습니다'),
      );
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'non-exist-slug' },
        relations: ['category'],
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          requiredRole: true,
          category: {
            id: true,
            name: true,
          },
        },
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
});
