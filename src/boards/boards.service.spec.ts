import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service';
import { Board } from './entities/board.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { createBoard } from './factories/board.factory';
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';

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
    it('should return board list items with selected fields ordered by name ASC', async () => {
      // given
      const mockBoards = [
        createBoard({
          id: 1,
          slug: 'board-a',
          name: 'Board A',
          description: 'Description A',
        }),
        createBoard({
          id: 2,
          slug: 'board-b',
          name: 'Board B',
          description: 'Description B',
        }),
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockBoards),
      };

      jest
        .spyOn(boardRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      // when
      const result = await service.findAllForList();

      // then
      expect(result).toEqual([
        {
          id: 1,
          slug: 'board-a',
          name: 'Board A',
          description: 'Description A',
        },
        {
          id: 2,
          slug: 'board-b',
          name: 'Board B',
          description: 'Description B',
        },
      ]);

      expect(boardRepository.createQueryBuilder).toHaveBeenCalledWith('board');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'board.id',
        'board.slug',
        'board.name',
        'board.description',
      ]);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'board.name',
        'ASC',
      );
    });
  });

  describe('findOne', () => {
    it('should return a board when found', async () => {
      const testCategory = createCategory({
        slugs: [createCategorySlug({ slug: 'test-board-slug' })],
      });
      const testBoard = createBoard({
        id: 1,
        name: 'Test Board',
        category: testCategory,
        slug: 'test-board-slug',
        description: 'Test description',
      });

      (boardRepository.findOne as jest.Mock).mockResolvedValue(testBoard);

      const result = await service.findOne('test-board-slug');
      expect(result).toEqual(testBoard);
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { slug: 'test-board-slug' },
        relations: ['category'],
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
      });
    });
  });
});
