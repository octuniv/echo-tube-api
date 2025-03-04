import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';
import { DeletePostResultDto } from './dto/delete-result.dto';

const mockPostsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByUser: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('PostsController', () => {
  let controller: PostsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a post', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'Test Content',
      };
      const req = { user: { id: 1 } } as any;
      mockPostsService.create.mockResolvedValue({ id: 1, ...createPostDto });

      expect(await controller.create(createPostDto, req)).toEqual({
        id: 1,
        ...createPostDto,
      });
    });
  });

  describe('findAll', () => {
    it('should return all posts', async () => {
      mockPostsService.findAll.mockResolvedValue([{ id: 1, title: 'Post' }]);
      expect(await controller.findAll()).toEqual([{ id: 1, title: 'Post' }]);
    });
  });

  describe('findByUser', () => {
    it('should return posts by user', async () => {
      mockPostsService.findByUser.mockResolvedValue([
        { id: 1, title: 'User Post' },
      ]);
      expect(await controller.findByUser(1)).toEqual([
        { id: 1, title: 'User Post' },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a single post', async () => {
      mockPostsService.findOne.mockResolvedValue({
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
      mockPostsService.update.mockResolvedValue({ id: 1, ...updatePostDto });

      expect(await controller.update(1, updatePostDto, req)).toEqual({
        id: 1,
        ...updatePostDto,
      });
    });
  });

  describe('delete', () => {
    it('should delete a post', async () => {
      const req = { user: { id: 1, role: UserRole.USER } } as any;
      mockPostsService.delete.mockResolvedValue(undefined);

      expect(await controller.delete(1, req)).toEqual({
        message: 'Post deleted successfully.',
      } satisfies DeletePostResultDto);
    });

    it('should throw error if delete method of postsService throw error', async () => {
      const req = { user: { id: 1, role: UserRole.USER } } as any;
      mockPostsService.delete.mockRejectedValue(
        new UnauthorizedException('You are not authorized to delete this post'),
      );

      expect(controller.delete(1, req)).rejects.toThrow(UnauthorizedException);
    });
  });
});
