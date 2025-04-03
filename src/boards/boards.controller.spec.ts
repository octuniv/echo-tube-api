import { Test, TestingModule } from '@nestjs/testing';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { BoardListItemDto } from './dto/board-list-item.dto';
import { createBoard } from './factories/board.factory';

describe('BoardsController', () => {
  let controller: BoardsController;
  let service: BoardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardsController],
      providers: [
        {
          provide: BoardsService,
          useValue: {
            findAllForList: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(BoardsController);
    service = module.get(BoardsService);
  });

  describe('GET /boards', () => {
    it('should return board list items with correct structure', async () => {
      // Arrange
      const mockResponse: BoardListItemDto[] = [
        {
          id: 1,
          slug: 'announcement',
          name: '공지사항',
          description: '공지사항 게시판',
        },
        {
          id: 2,
          slug: 'qna',
          name: '질문답변',
          description: '기술 질문 게시판',
        },
      ].map(createBoard);
      jest.spyOn(service, 'findAllForList').mockResolvedValue(mockResponse);

      // Act
      const result = await controller.findAllForList();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(service.findAllForList).toHaveBeenCalledTimes(1);
      result.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
      });
    });
  });
});
