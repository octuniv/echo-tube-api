import { Test, TestingModule } from '@nestjs/testing';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { BoardListItemDto } from './dto/board-list-item.dto';
import { createBoard } from './factories/board.factory';
import { ScrapingTargetBoardDto } from './dto/scraping-target-board.dto';
import { createScrapingTargetBoard } from './factories/scraping-target-board.factory';

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
            getScrapingTargetBoards: jest.fn(),
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

  describe('GET /boards/scraping-targets', () => {
    it('should return scraping target boards with correct structure', async () => {
      // Arrange
      const mockResponse: ScrapingTargetBoardDto[] = [
        createScrapingTargetBoard({
          slug: 'youtube-channel',
          name: 'Music Videos',
        }),
        createScrapingTargetBoard({ slug: 'webinars', name: 'Tech Webinars' }),
      ];

      jest
        .spyOn(service, 'getScrapingTargetBoards')
        .mockResolvedValue(mockResponse);

      // Act
      const result = await controller.getScrapingTargets();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(service.getScrapingTargetBoards).toHaveBeenCalledTimes(1);
      result.forEach((board) => {
        expect(board).toHaveProperty('slug');
        expect(board).toHaveProperty('name');
        expect(Object.keys(board)).toHaveLength(2); // slug, name만 존재 확인
      });
    });

    it('should handle empty response', async () => {
      // Arrange
      jest.spyOn(service, 'getScrapingTargetBoards').mockResolvedValue([]);

      // Act
      const result = await controller.getScrapingTargets();

      // Assert
      expect(result).toEqual([]);
      expect(service.getScrapingTargetBoards).toHaveBeenCalled();
    });
  });
});
