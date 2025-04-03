import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PostResponseDto } from '@/posts/dto/post-response.dto';
import { createBoard } from '@/boards/factories/board.factory';
import { createPost } from '@/posts/factories/post.factory';
import { DashboardSummaryDto } from './dto/dashboard.summary.dto';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getDashboardSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('should return dashboard summary with recent and popular posts', async () => {
    // Arrange: Updated mock data structure
    const mockSummary = {
      visitors: 150,
      recentPosts: [
        createPost({
          id: 1,
          title: 'Recent Post 1',
          board: createBoard({ id: 1, name: 'Board 1' }),
          hotScore: 95,
        }),
      ].map(PostResponseDto.fromEntity),
      popularPosts: [
        createPost({
          id: 2,
          title: 'Popular Post 1',
          board: createBoard({ id: 2, name: 'Board 2' }),
          hotScore: 100,
        }),
      ].map(PostResponseDto.fromEntity),
      noticesPosts: [
        createPost({
          id: 3,
          title: 'notice 1',
          board: createBoard({ id: 2, name: 'Board 2', slug: 'notices' }),
          hotScore: 100,
        }),
      ].map(PostResponseDto.fromEntity),
    };

    jest
      .spyOn(service, 'getDashboardSummary')
      .mockResolvedValue(
        DashboardSummaryDto.fromData(
          mockSummary.visitors,
          mockSummary.recentPosts,
          mockSummary.popularPosts,
          mockSummary.noticesPosts,
        ),
      );

    // Act
    const result = await controller.getSummary();

    // Assert
    expect(result).toEqual(mockSummary);
    expect(service.getDashboardSummary).toHaveBeenCalled();
    expect(result.recentPosts).toHaveLength(1);
    expect(result.popularPosts).toHaveLength(1);
  });
});
