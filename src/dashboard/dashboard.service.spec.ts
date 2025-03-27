import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { VisitorService } from '@/visitor/visitor.service';
import { Repository } from 'typeorm';
import { createFakePost } from '@/posts/faker/post.faker';

describe('DashboardService', () => {
  let service: DashboardService;
  let postRepository: Repository<Post>;
  let visitorService: VisitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            find: jest.fn(),
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

    service = module.get<DashboardService>(DashboardService);
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    visitorService = module.get<VisitorService>(VisitorService);
  });

  it('should return summary with popular posts and visitors', async () => {
    const mockPosts: Post[] = [
      createFakePost(),
      createFakePost(),
      createFakePost(),
    ];
    const mockVisitors = 150;

    jest.spyOn(postRepository, 'find').mockResolvedValue(mockPosts);
    jest
      .spyOn(visitorService, 'getTodayVisitors')
      .mockResolvedValue(mockVisitors);

    const result = await service.getDashboardSummary();

    expect(result).toEqual({
      visitors: mockVisitors,
      popularPosts: mockPosts.map((post) => ({
        id: post.id,
        title: post.title,
        views: post.views,
      })),
    });

    expect(result.popularPosts[0]).toHaveProperty('id');
    expect(result.popularPosts[0]).toHaveProperty('title');
    expect(result.popularPosts[0]).toHaveProperty('views');

    expect(postRepository.find).toHaveBeenCalledWith({
      order: { views: 'DESC' },
      take: 3,
      select: ['id', 'title', 'views'],
    });
    expect(visitorService.getTodayVisitors).toHaveBeenCalled();
  });
});
