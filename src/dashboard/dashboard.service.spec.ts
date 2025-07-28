import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService, NOTICE_BOARD_SLUG } from './dashboard.service';
import { VisitorService } from '@/visitor/visitor.service';
import { createPost } from '@/posts/factories/post.factory';
import { PostsService } from '@/posts/posts.service';
import { createBoard } from '@/boards/factories/board.factory';
import { PostResponseDto } from '@/posts/dto/post-response.dto';
import { InternalServerErrorException } from '@nestjs/common';
import { createCategorySlug } from '@/categories/factories/category.factory';

describe('DashboardService', () => {
  let service: DashboardService;
  let postsService: PostsService;
  let visitorsService: VisitorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PostsService,
          useValue: {
            findPopularPosts: jest.fn(),
            findRecentPosts: jest.fn(),
            findPostsByBoardSlug: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();
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

    const mockNoticesPosts = [
      createPost({
        id: 4,
        title: '공지사항 1',
        board: createBoard({
          categorySlug: createCategorySlug({ slug: NOTICE_BOARD_SLUG }),
        }),
      }),
    ];

    // Mock service methods
    jest
      .spyOn(postsService, 'findPopularPosts')
      .mockResolvedValue(mockPopularPosts.map(PostResponseDto.fromEntity));
    jest
      .spyOn(postsService, 'findRecentPosts')
      .mockResolvedValue(mockRecentPosts.map(PostResponseDto.fromEntity));
    jest
      .spyOn(postsService, 'findPostsByBoardSlug')
      .mockResolvedValue(mockNoticesPosts.map(PostResponseDto.fromEntity));
    jest
      .spyOn(visitorsService, 'getTodayVisitors')
      .mockResolvedValue(mockVisitors);

    // Act
    const result = await service.getDashboardSummary();

    // Assert
    expect(postsService.findPopularPosts).toHaveBeenCalledWith([
      NOTICE_BOARD_SLUG,
    ]); // 변경된 파라미터 검증
    expect(postsService.findRecentPosts).toHaveBeenCalledWith([], 10, [
      NOTICE_BOARD_SLUG,
    ]); // 변경된 파라미터 검증
    expect(result).toEqual({
      visitors: mockVisitors,
      recentPosts: mockRecentPosts.map(PostResponseDto.fromEntity),
      popularPosts: mockPopularPosts.map(PostResponseDto.fromEntity),
      noticesPosts: mockNoticesPosts.map(PostResponseDto.fromEntity), // 새 필드 검증
    });
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    jest
      .spyOn(postsService, 'findPopularPosts')
      .mockRejectedValue(new Error('DB Error'));

    // Act & Assert
    await expect(service.getDashboardSummary()).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
