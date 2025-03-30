import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { VisitorService } from '@/visitor/visitor.service';
import { Repository } from 'typeorm';
import { createPost } from '@/posts/factories/post.factory';
import { Board } from '@/boards/entities/board.entity';

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
    const mockBoard = { name: '테스트 게시판' };
    const mockPosts: Post[] = [
      createPost({
        id: 1,
        hotScore: 100,
        board: mockBoard as Board,
      }),
      createPost({
        id: 2,
        hotScore: 95,
        board: mockBoard as Board,
      }),
      createPost({
        id: 3,
        hotScore: 90,
        board: mockBoard as Board,
      }),
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
        boardName: mockBoard.name,
        hotScore: post.hotScore,
      })),
    });

    expect(postRepository.find).toHaveBeenCalledWith({
      order: { hotScore: 'DESC' },
      take: 10,
      relations: ['board'],
      select: {
        id: true,
        title: true,
        hotScore: true,
        board: { name: true },
      },
    });

    expect(visitorService.getTodayVisitors).toHaveBeenCalled();
  });
});
