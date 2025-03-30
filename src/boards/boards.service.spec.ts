import { Test, TestingModule } from '@nestjs/testing';
import { BoardsService } from './boards.service';
import { Board } from './entities/board.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { createBoard } from './factories/board.factory';
import { createCategory } from '@/categories/factories/category.factory';

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
        order: { category: 'ASC', name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a board when found', async () => {
      const testCategory = createCategory({ id: 1 });
      const testBoard = createBoard({
        id: 1,
        name: 'Test Board',
        category: testCategory,
        slug: 'test-board-slug',
        description: 'Test description',
      });

      (boardRepository.findOne as jest.Mock).mockResolvedValue(testBoard);

      const result = await service.findOne(1);
      expect(result).toEqual(testBoard);
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
    });

    it('should throw NotFoundException when board not found', async () => {
      (boardRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException('게시판을 찾을 수 없습니다'),
      );
      expect(boardRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
        relations: ['category'],
      });
    });
  });
});
