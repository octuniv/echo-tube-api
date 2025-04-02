import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { VisitorService } from '@/visitor/visitor.service';
import { createPost } from '@/posts/factories/post.factory';
import { PostsService } from '@/posts/posts.service';
import { createBoard } from '@/boards/factories/board.factory';
import { PostResponseDto } from '@/posts/dto/post-response.dto';

describe('DashboardService', () => {
  let service: DashboardService;
  let postsService: PostsService;
  let visitorsService: VisitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PostsService,
          useValue: {
            findPopularPosts: jest.fn(),
            findRecentPosts: jest.fn(),
          },
        },
        {
          provide: VisitorService,
          useValue: {
            getTodayVisitors: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(DashboardService);
    postsService = module.get(PostsService);
    visitorsService = module.get(VisitorService);
  });

  it('should return summary with recent posts, popular posts, and visitors', async () => {
    // Arrange
    const mockPopularPosts = [
      createPost({
        id: 1,
        title: 'Hot Post 1',
        hotScore: 100,
        board: createBoard({ name: 'Board 1' }),
      }),
      createPost({
        id: 2,
        title: 'Hot Post 2',
        hotScore: 95,
        board: createBoard({ name: 'Board 2' }),
      }),
    ];

    const mockRecentPosts = [
      createPost({
        id: 3,
        title: 'Recent Post 1',
        createdAt: new Date(),
        board: createBoard({ name: 'Board 3' }),
      }),
    ];

    const mockVisitors = 150;

    // Mock service methods
    jest
      .spyOn(postsService, 'findPopularPosts')
      .mockResolvedValue(mockPopularPosts.map(PostResponseDto.fromEntity));

    jest
      .spyOn(postsService, 'findRecentPosts')
      .mockResolvedValue(mockRecentPosts.map(PostResponseDto.fromEntity));

    jest
      .spyOn(visitorsService, 'getTodayVisitors')
      .mockResolvedValue(mockVisitors);

    // Act
    const result = await service.getDashboardSummary();

    // Assert
    expect(result).toEqual({
      visitors: mockVisitors,
      recentPosts: mockRecentPosts.map(PostResponseDto.fromEntity),
      popularPosts: mockPopularPosts.map(PostResponseDto.fromEntity),
    });

    expect(postsService.findPopularPosts).toHaveBeenCalled();
    expect(postsService.findRecentPosts).toHaveBeenCalled();
    expect(visitorsService.getTodayVisitors).toHaveBeenCalled();
  });

  it('should handle empty posts', async () => {
    // Mock empty responses
    jest.spyOn(postsService, 'findPopularPosts').mockResolvedValue([]);
    jest.spyOn(postsService, 'findRecentPosts').mockResolvedValue([]);
    jest.spyOn(visitorsService, 'getTodayVisitors').mockResolvedValue(0);

    const result = await service.getDashboardSummary();

    expect(result).toEqual({
      visitors: 0,
      recentPosts: [],
      popularPosts: [],
    });
  });
});
