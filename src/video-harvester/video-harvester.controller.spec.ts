import { Test, TestingModule } from '@nestjs/testing';
import { VideoHarvesterController } from './video-harvester.controller';
import { PostsService } from '@/posts/posts.service';
import { CreateScrapedVideoDto } from './dto/create-scraped-video.dto';
import { PostResponseDto } from '@/posts/dto/post-response.dto';
import { PostOrigin } from '@/posts/entities/post.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { createPost } from '@/posts/factories/post.factory';
import { createBoard } from '@/boards/factories/board.factory';
import { VideoFactory } from './factory/video.factory';
import { createCategorySlug } from '@/categories/factories/category.factory';

describe('VideoHarvesterController', () => {
  let controller: VideoHarvesterController;
  let postsService: PostsService;

  const mockPost = createPost({
    id: 1,
    title: 'Test Video',
    channelTitle: 'Test Channel',
    duration: 'PT5M',
    videoUrl: 'https://youtu.be/abc123',
    type: PostOrigin.SCRAPED,
    board: createBoard({
      id: 1,
      categorySlug: createCategorySlug({ slug: 'video-board' }),
      name: 'Video Board',
      requiredRole: UserRole.USER,
    }),
    hotScore: 1625648794,
    views: 0,
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockDto: CreateScrapedVideoDto = new VideoFactory().create();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoHarvesterController],
      providers: [
        {
          provide: PostsService,
          useValue: {
            createScrapedPost: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(VideoHarvesterController);
    postsService = module.get(PostsService);
  });

  it('should create a scraped video post', async () => {
    jest.spyOn(postsService, 'createScrapedPost').mockResolvedValue(mockPost);

    const result = await controller.createVideo(mockDto, 'video-board', {
      user: { role: UserRole.BOT },
    } as any);

    expect(postsService.createScrapedPost).toHaveBeenCalledWith(
      mockDto,
      'video-board',
      { role: UserRole.BOT },
    );
    expect(result).toEqual(PostResponseDto.fromEntity(mockPost));
  });

  it('should throw NotFoundException if board is invalid', async () => {
    jest
      .spyOn(postsService, 'createScrapedPost')
      .mockRejectedValue(new Error('Board not found'));

    await expect(
      controller.createVideo(mockDto, 'invalid-slug', { user: {} } as any),
    ).rejects.toThrow();
  });

  it('should enforce BOT role requirement', async () => {
    const nonBotUser = { role: UserRole.USER };
    await expect(
      controller.createVideo(mockDto, 'video-board', {
        user: nonBotUser,
      } as any),
    ).rejects.toThrow();
  });
});
