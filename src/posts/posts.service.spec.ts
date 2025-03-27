import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { Repository, UpdateResult } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { User } from '@/users/entities/user.entity';
import {
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryPostDto } from './dto/query-post.dto';
import { createMock } from '@golevelup/ts-jest';
import { VisitorService } from '@/visitor/visitor.service';

describe('PostsService', () => {
  let service: PostsService;
  let visitorService: VisitorService;
  let postRepository: Repository<Post>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: createMock<Repository<Post>>(),
        },
        {
          provide: VisitorService,
          useValue: createMock<VisitorService>(),
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    visitorService = module.get<VisitorService>(VisitorService);
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a new post', async () => {
      const createPostDto = { title: 'Test Post', content: 'Test Content' };
      const user = { id: 1 } as User;
      const savedPost = { id: 1, ...createPostDto, createdBy: user } as Post;

      postRepository.create = jest.fn().mockReturnValue(savedPost);
      postRepository.save = jest.fn().mockResolvedValue(savedPost);

      const result = await service.create(createPostDto, user);
      expect(result).toEqual(QueryPostDto.fromEntity(savedPost));
      expect(postRepository.create).toHaveBeenCalledWith({
        ...createPostDto,
        createdBy: user,
      });
      expect(postRepository.save).toHaveBeenCalledWith(savedPost);
    });
  });

  describe('findAll', () => {
    it('should return an array of posts', async () => {
      const posts = [{ id: 1, title: 'Post 1' }] as Post[];
      postRepository.find = jest.fn().mockResolvedValue(posts);

      const result = await service.findAll();
      expect(result).toEqual(posts);
      expect(postRepository.find).toHaveBeenCalledWith({
        relations: ['createdBy'],
      });
    });
  });

  describe('findByUser', () => {
    it('should return an array of posts', async () => {
      const posts = [{ id: 1, title: 'Post 1' }] as Post[];
      postRepository.find = jest.fn().mockResolvedValue(posts);

      const result = await service.findByUser(1);
      expect(result).toEqual(posts);
      expect(postRepository.find).toHaveBeenCalledWith({
        where: { createdBy: { id: 1 } },
        relations: ['createdBy'],
      });
    });

    it('should return empty array when post is not found', async () => {
      postRepository.find = jest.fn().mockResolvedValue([]);
      await expect(service.findByUser(999)).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a post when found', async () => {
      const post = { id: 1, title: 'Test Post', views: 0 } as Post;
      postRepository.findOne = jest.fn().mockResolvedValue(post);

      const result = await service.findOne(1);
      expect(result).toEqual({ ...post, views: 1 });
      expect(visitorService.upsertVisitorCount).toHaveBeenCalled();
      expect(postRepository.save).toHaveBeenCalledWith({ ...post, views: 1 });
    });

    it('should throw NotFoundException when post is not found', async () => {
      postRepository.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the post if authorized', async () => {
      const post = { id: 1, createdBy: { id: 1 } } as Post;
      const updatePostDto = { title: 'Updated Title' };
      postRepository.findOne = jest.fn().mockResolvedValue(post);
      postRepository.save = jest
        .fn()
        .mockResolvedValue({ ...post, ...updatePostDto });

      const result = await service.update(1, updatePostDto, 1, false);
      expect(result.title).toEqual('Updated Title');
    });

    it('should throw UnauthorizedException if not the owner or admin', async () => {
      const post = { id: 1, createdBy: { id: 2 } } as Post;
      postRepository.findOne = jest.fn().mockResolvedValue(post);

      await expect(service.update(1, {}, 1, false)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('delete', () => {
    it('should delete the post if authorized', async () => {
      const post = { id: 1, createdBy: { id: 1 } } as Post;
      postRepository.findOne = jest.fn().mockResolvedValue(post);
      postRepository.softDelete = jest.fn().mockResolvedValue({
        raw: [],
        affected: 1,
        generatedMaps: [],
      } satisfies UpdateResult);

      await expect(service.delete(1, 1, false)).resolves.toBeUndefined();
      expect(postRepository.softDelete).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException if not the owner or admin', async () => {
      const post = { id: 1, createdBy: { id: 2 } } as Post;
      postRepository.findOne = jest.fn().mockResolvedValue(post);

      await expect(service.delete(1, 1, false)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException if post uninstall fails', async () => {
      const post = { id: 1, createdBy: { id: 1 } } as Post;
      postRepository.findOne = jest.fn().mockResolvedValue(post);
      postRepository.softDelete = jest.fn().mockResolvedValue({
        raw: [],
        affected: 0,
        generatedMaps: [],
      } satisfies UpdateResult);

      await expect(service.delete(1, 1, false)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
