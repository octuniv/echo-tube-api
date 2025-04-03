import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';
import { DeletePostResultDto } from './dto/delete-result.dto';
import { createMock } from '@golevelup/ts-jest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { createPost } from './factories/post.factory';
import { FindRecentPostsDto } from './dto/find-recent.dto';

describe('PostsController', () => {
  let controller: PostsController;
  let service: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: createMock<PostsService>(),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PostsController>(PostsController);
    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a post', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'Test Content',
        boardSlug: 'exist-slug',
      };
      const req = { user: { id: 1 } } as any;
      service.create = jest.fn().mockResolvedValue({ id: 1, ...createPostDto });

      expect(await controller.create(createPostDto, req)).toEqual({
        id: 1,
        ...createPostDto,
      });
    });
  });

  describe('findAll', () => {
    it('should return all posts', async () => {
      service.findAll = jest.fn().mockResolvedValue([{ id: 1, title: 'Post' }]);
      expect(await controller.findAll()).toEqual([{ id: 1, title: 'Post' }]);
    });
  });

  describe('findByUser', () => {
    it('should return posts by user', async () => {
      service.findByUser = jest
        .fn()
        .mockResolvedValue([{ id: 1, title: 'User Post' }]);
      expect(await controller.findByUser(1)).toEqual([
        { id: 1, title: 'User Post' },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a single post', async () => {
      service.findOne = jest.fn().mockResolvedValue({
        id: 1,
        title: 'Single Post',
      });
      expect(await controller.findOne(1)).toEqual({
        id: 1,
        title: 'Single Post',
      });
    });
  });

  describe('update', () => {
    it('should update a post', async () => {
      const updatePostDto: UpdatePostDto = { title: 'Updated Title' };
      const req = { user: { id: 1, role: UserRole.USER } } as any;
      service.update = jest.fn().mockResolvedValue({ id: 1, ...updatePostDto });

      expect(await controller.update(1, updatePostDto, req)).toEqual({
        id: 1,
        ...updatePostDto,
      });
    });
  });

  describe('delete', () => {
    it('should delete a post', async () => {
      const req = { user: { id: 1, role: UserRole.USER } } as any;
      service.delete = jest.fn().mockResolvedValue(undefined);

      expect(await controller.delete(1, req)).toEqual({
        message: 'Post deleted successfully.',
      } satisfies DeletePostResultDto);
    });

    it('should throw error if delete method of postsService throw error', async () => {
      const req = { user: { id: 1, role: UserRole.USER } } as any;
      service.delete = jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException(
            'You are not authorized to delete this post',
          ),
        );

      expect(controller.delete(1, req)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findRecent', () => {
    it('should return recent posts with default parameters', async () => {
      const mockPosts = [createPost({ id: 1, title: 'Recent Post' })];
      service.findRecentPosts = jest.fn().mockResolvedValue(mockPosts);
      const findRecentPostDto = {
        boardIds: [1],
        limit: 5,
      } satisfies FindRecentPostsDto;

      const result = await controller.findRecent(findRecentPostDto);
      expect(service.findRecentPosts).toHaveBeenCalledWith([1], 5);
      expect(result).toEqual(mockPosts);
    });
  });

  describe('findByBoard', () => {
    it('should look up posts on specific boards', async () => {
      // Arrange
      const boardId = 1;
      const mockPosts = [
        { id: 1, title: 'Test Post 1' },
        { id: 2, title: 'Test Post 2' },
      ].map((post) => createPost(post));
      service.findPostsByBoardId = jest.fn().mockResolvedValue(mockPosts);

      // Act
      const result = await controller.findByBoard(boardId);

      // Assert
      expect(service.findPostsByBoardId).toHaveBeenCalledWith(boardId);
      expect(result).toEqual(mockPosts);
    });

    it('should return empty array If no post is present', async () => {
      // Arrange
      const boardId = 999;
      service.findPostsByBoardId = jest.fn().mockResolvedValue([]);

      // Act
      const result = await controller.findByBoard(boardId);

      // Assert
      expect(service.findPostsByBoardId).toHaveBeenCalledWith(boardId);
      expect(result).toEqual([]);
    });
  });
});
