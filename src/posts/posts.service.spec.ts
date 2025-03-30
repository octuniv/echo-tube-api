import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { In, Repository, UpdateResult } from 'typeorm';
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
import { BoardsService } from '@/boards/boards.service';
import { CategoriesService } from '@/categories/categories.service';
import { createBoard } from '@/boards/factories/board.factory';
import { createCategory } from '@/categories/factories/category.factory';
import { createPost } from './factories/post.factory';
import { CreatePostDto } from './dto/create-post.dto';

describe('PostsService', () => {
  let service: PostsService;
  let postRepository: Repository<Post>;
  let boardsService: BoardsService;
  let categoriesService: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: createMock<Repository<Post>>(),
        },
        {
          provide: BoardsService,
          useValue: createMock<BoardsService>(),
        },
        {
          provide: CategoriesService,
          useValue: createMock<CategoriesService>(),
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    boardsService = module.get<BoardsService>(BoardsService);
    categoriesService = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a new post', async () => {
      const boardSlug = 'exist-slug';
      const createPostDto = {
        title: 'Test Post',
        content: 'Test Content',
        boardSlug,
      } satisfies CreatePostDto;
      const user = { id: 1 } as User;
      const mockDate = new Date('2025-03-29T00:00:00Z').getTime();
      const initialHotScore = mockDate / 1000;

      jest.spyOn(Date, 'now').mockReturnValue(mockDate);

      const board = createBoard({
        category: createCategory({ name: 'TestCategory' }),
        slug: boardSlug,
      });

      const savedPost = createPost({
        id: 1,
        ...createPostDto,
        board,
        createdBy: user,
        createdAt: new Date(),
        hotScore: initialHotScore,
        setNickname: jest.fn(),
      }) as Post;

      jest.spyOn(boardsService, 'findOne').mockResolvedValue(board);
      jest.spyOn(categoriesService, 'validateSlug').mockResolvedValue();
      postRepository.create = jest.fn().mockReturnValue(savedPost);
      postRepository.save = jest.fn().mockResolvedValueOnce(savedPost);

      const result = await service.create(createPostDto, user);

      expect(boardsService.findOne).toHaveBeenCalledWith(boardSlug);
      expect(categoriesService.validateSlug).toHaveBeenCalledWith(
        board.category.name,
        board.slug,
      );
      expect(postRepository.create).toHaveBeenCalledWith({
        ...createPostDto,
        board,
        createdBy: user,
        hotScore: initialHotScore,
      });
      expect(postRepository.save).toHaveBeenCalledTimes(1);
      expect(postRepository.save).toHaveBeenCalledWith(savedPost);
      expect(result).toEqual(
        QueryPostDto.fromEntity({
          ...savedPost,
          setNickname: expect.any(Function),
        }),
      );
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

  describe('findRecentPosts', () => {
    it('should return recent posts from specified boards ordered by creation date', async () => {
      // Arrange
      const boardIds = [1, 2];
      const mockPosts = [
        createPost({
          id: 1,
          title: 'Post 1',
          board: createBoard({ id: 1 }),
          createdAt: new Date('2023-01-02'),
        }),
        createPost({
          id: 2,
          title: 'Post 2',
          board: createBoard({ id: 2 }),
          createdAt: new Date('2023-01-01'),
        }),
      ];

      postRepository.find = jest.fn().mockResolvedValue(mockPosts);

      // Act
      const result = await service.findRecentPosts(boardIds, 5);

      // Assert
      expect(postRepository.find).toHaveBeenCalledWith({
        where: { board: { id: In(boardIds) } },
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['board'],
      });
      expect(result).toEqual(mockPosts.map(QueryPostDto.fromEntity));
    });

    it('should return empty array when no posts found', async () => {
      postRepository.find = jest.fn().mockResolvedValue([]);
      const result = await service.findRecentPosts([999], 5);
      expect(result).toEqual([]);
    });
  });

  describe('findByBoard', () => {
    it('should return all posts in the specified board', async () => {
      // Arrange
      const boardId = 1;
      const mockPosts = [
        createPost({ id: 1, title: 'Post 1', board: createBoard({ id: 1 }) }),
        createPost({ id: 2, title: 'Post 2', board: createBoard({ id: 1 }) }),
      ] as Post[];

      postRepository.find = jest.fn().mockResolvedValue(mockPosts);

      // Act
      const result = await service.findByBoard(boardId);

      // Assert
      expect(postRepository.find).toHaveBeenCalledWith({
        where: { board: { id: boardId } },
        relations: ['createdBy', 'board'],
      });
      expect(result).toEqual(mockPosts.map(QueryPostDto.fromEntity));
    });

    it('should return empty array when board has no posts', async () => {
      postRepository.find = jest.fn().mockResolvedValue([]);
      const result = await service.findByBoard(999);
      expect(result).toEqual([]);
    });
  });

  describe('updateHotScores', () => {
    it('should update hot scores for all posts based on the formula', async () => {
      // Arrange
      const mockDate = new Date('2023-10-01T00:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockDate);

      const posts = [
        createPost({
          id: 1,
          createdAt: new Date('2023-09-30T00:00:00Z'),
          views: 10,
          hotScore: 0,
        }),
        createPost({
          id: 2,
          createdAt: new Date('2023-09-29T00:00:00Z'),
          views: 5,
          hotScore: 0,
        }),
      ];

      postRepository.find = jest.fn().mockResolvedValue(posts);
      postRepository.save = jest.fn().mockImplementation((post) => post);

      // Act
      await service.updateHotScores();

      // Assert
      expect(postRepository.find).toHaveBeenCalled();

      posts.forEach((post) => {
        const age = mockDate - post.createdAt.getTime();
        const ageInHours = age / (1000 * 60 * 60);
        const expectedHotScore =
          post.views * 1.5 + (1 / Math.pow(ageInHours + 2, 1.5)) * 100;
        expect(post.hotScore).toBeCloseTo(expectedHotScore, 5);
      });

      expect(postRepository.save).toHaveBeenCalledTimes(posts.length);
      posts.forEach((post, index) => {
        expect(postRepository.save).toHaveBeenNthCalledWith(index + 1, post);
      });
    });

    it('should handle empty posts array', async () => {
      postRepository.find = jest.fn().mockResolvedValue([]);
      await service.updateHotScores();
      expect(postRepository.save).not.toHaveBeenCalled();
    });
  });
});
