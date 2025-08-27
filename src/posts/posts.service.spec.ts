import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { Repository, UpdateResult } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post, PostOrigin } from './entities/post.entity';
import {
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostResponseDto } from './dto/post-response.dto';
import { createMock } from '@golevelup/ts-jest';
import { BoardsService } from '@/boards/boards.service';
import { CategoriesService } from '@/categories/categories.service';
import { createBoard } from '@/boards/factories/board.factory';
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';
import { createPost } from './factories/post.factory';
import { CreatePostDto } from './dto/create-post.dto';
import { createUserEntity } from '@/users/factory/user.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { CreateScrapedVideoDto } from '@/video-harvester/dto/create-scraped-video.dto';
import { VideoFactory } from '@/video-harvester/factory/video.factory';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CommentsService } from '@/comments/comments.service';
import { PostLike } from './entities/post-like.entity';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

const mockQueryBuilder = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

describe('PostsService', () => {
  let service: PostsService;
  let postRepository: Repository<Post>;
  let postLikeRepository: Repository<PostLike>;
  let boardsService: BoardsService;
  let categoriesService: CategoriesService;
  let commentsService: CommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: createMock<Repository<Post>>(),
        },
        {
          provide: getRepositoryToken(PostLike),
          useValue: createMock<Repository<PostLike>>(),
        },
        {
          provide: BoardsService,
          useValue: createMock<BoardsService>(),
        },
        {
          provide: CategoriesService,
          useValue: createMock<CategoriesService>(),
        },
        {
          provide: CommentsService,
          useValue: { softDeletePostComments: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    postLikeRepository = module.get<Repository<PostLike>>(
      getRepositoryToken(PostLike),
    );
    boardsService = module.get<BoardsService>(BoardsService);
    categoriesService = module.get<CategoriesService>(CategoriesService);
    commentsService = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw UnauthorizedException when user lacks required role', async () => {
      const board = createBoard({
        categorySlug: createCategorySlug({ slug: 'test' }),
        requiredRole: UserRole.ADMIN,
      });
      jest.spyOn(boardsService, 'findOneBySlug').mockResolvedValue(board);
      const user = createUserEntity({ id: 1, role: UserRole.USER });

      await expect(
        service.create(
          {
            title: 'Test',
            content: 'Test',
            boardSlug: 'test',
          },
          user,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create and return a new post', async () => {
      const boardSlug = 'exist-slug';
      const createPostDto = {
        title: 'Test Post',
        content: 'Test Content',
        boardSlug,
      } satisfies CreatePostDto;
      const user = createUserEntity({ id: 1, role: UserRole.USER });
      const mockDate = new Date('2025-03-29T00:00:00Z').getTime();
      const initialHotScore = mockDate / 1000;

      jest.spyOn(Date, 'now').mockReturnValue(mockDate);

      const board = createBoard({
        category: createCategory({ name: 'TestCategory' }),
        categorySlug: createCategorySlug({ slug: boardSlug }),
        requiredRole: UserRole.USER,
      });

      const savedPost = createPost({
        id: 1,
        title: createPostDto.title,
        content: createPostDto.content,
        board,
        createdBy: user,
        createdAt: new Date(),
        hotScore: initialHotScore,
        setNickname: jest.fn(),
      });

      jest.spyOn(boardsService, 'findOneBySlug').mockResolvedValue(board);
      jest
        .spyOn(categoriesService, 'verifySlugBelongsToCategory')
        .mockResolvedValue();
      postRepository.create = jest.fn().mockReturnValue(savedPost);
      postRepository.save = jest.fn().mockResolvedValueOnce(savedPost);

      const result = await service.create(createPostDto, user);

      expect(boardsService.findOneBySlug).toHaveBeenCalledWith(boardSlug);
      expect(
        categoriesService.verifySlugBelongsToCategory,
      ).toHaveBeenCalledWith(board.category.name, board.categorySlug.slug);
      expect(postRepository.create).toHaveBeenCalledWith({
        title: createPostDto.title,
        content: createPostDto.content,
        board,
        createdBy: user,
        hotScore: initialHotScore,
      });
      expect(postRepository.save).toHaveBeenCalledTimes(1);
      expect(postRepository.save).toHaveBeenCalledWith(savedPost);
      expect(result).toEqual(
        PostResponseDto.fromEntity({
          ...savedPost,
          nickname: savedPost.createdBy.nickname,
          setNickname: expect.any(Function),
        }),
      );
      expect(result.type).toBe(PostOrigin.USER);
    });
  });

  describe('findAll', () => {
    it('should return an array of posts', async () => {
      const posts = [{ id: 1, title: 'Post 1' }].map(createPost);
      postRepository.find = jest.fn().mockResolvedValue(posts);

      const result = await service.findAll();
      expect(result).toEqual(posts.map(PostResponseDto.fromEntity));
      expect(postRepository.find).toHaveBeenCalledWith({
        relations: {
          createdBy: true,
          board: {
            categorySlug: true,
          },
        },
      });
    });
  });

  describe('findByUser', () => {
    it('should return an array of posts', async () => {
      const posts = [{ id: 1, title: 'Post 1' }].map(createPost);
      postRepository.find = jest.fn().mockResolvedValue(posts);

      const result = await service.findByUser(1);
      expect(result).toEqual(posts.map(PostResponseDto.fromEntity));
      expect(postRepository.find).toHaveBeenCalledWith({
        where: { createdBy: { id: 1 } },
        relations: {
          createdBy: true,
          board: {
            categorySlug: true,
          },
        },
      });
    });

    it('should return empty array when post is not found', async () => {
      postRepository.find = jest.fn().mockResolvedValue([]);
      await expect(service.findByUser(999)).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a post when found', async () => {
      const post = createPost({
        id: 1,
        title: 'Test Post',
        views: 0,
      });
      postRepository.findOne = jest.fn().mockResolvedValue(post);

      const result = await service.findOne(1);
      expect(result).toEqual(
        PostResponseDto.fromEntity({
          ...post,
          views: 1,
          nickname: expect.any(String),
          setNickname: expect.any(Function),
        }),
      );
      expect(postRepository.save).toHaveBeenCalledWith({ ...post, views: 1 });
    });

    it('should throw NotFoundException when post is not found', async () => {
      postRepository.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw UnauthorizedException when user lacks board role', async () => {
      const board = createBoard({ requiredRole: UserRole.ADMIN });
      const user = createUserEntity({ id: 1, role: UserRole.USER });
      const post = createPost({
        board,
        createdBy: createUserEntity({ id: 2, role: UserRole.ADMIN }),
      });
      jest.spyOn(service, 'findById').mockResolvedValue(post);

      await expect(service.update(1, {}, user)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if not the owner', async () => {
      const user = createUserEntity({ id: 1, role: UserRole.USER });
      const post = createPost({
        id: 1,
        createdBy: createUserEntity({ id: 2 }),
      });
      postRepository.findOne = jest.fn().mockResolvedValue(post);

      await expect(service.update(1, {}, user)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow admin to update regardless of ownership', async () => {
      const board = createBoard({ requiredRole: UserRole.USER });
      const post = createPost({
        board,
        createdBy: createUserEntity({ id: 2, role: UserRole.USER }),
      });
      jest.spyOn(service, 'findById').mockResolvedValue(post);
      const adminUser = createUserEntity({ id: 1, role: UserRole.ADMIN });

      await service.update(1, { title: 'New Title' }, adminUser);
      expect(postRepository.save).toHaveBeenCalled();
    });

    it('should update and return the post if authorized', async () => {
      const user = createUserEntity({ id: 1 });
      const board = createBoard({ requiredRole: UserRole.USER });
      const post = createPost({
        board,
        createdBy: user,
      });
      const updatePostDto = { title: 'Updated Title' };
      postRepository.findOne = jest.fn().mockResolvedValue(post);
      postRepository.save = jest
        .fn()
        .mockResolvedValue({ ...post, ...updatePostDto });

      const result = await service.update(1, updatePostDto, user);
      expect(result.title).toEqual('Updated Title');
    });
  });

  describe('delete', () => {
    it('should throw UnauthorizedException when user lacks board role', async () => {
      const board = createBoard({ requiredRole: UserRole.ADMIN });
      const post = createPost({
        board,
        createdBy: createUserEntity({ id: 2, role: UserRole.ADMIN }),
      });
      jest.spyOn(service, 'findById').mockResolvedValue(post);
      const user = createUserEntity({ id: 1, role: UserRole.USER });

      await expect(service.delete(post.id, user)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if not the owner', async () => {
      const user = createUserEntity({ id: 1 });
      const post = createPost({
        id: 1,
        createdBy: createUserEntity({ id: 2 }),
      });
      postRepository.findOne = jest.fn().mockResolvedValue(post);

      await expect(service.delete(post.id, user)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException if post uninstall fails', async () => {
      const user = createUserEntity({ id: 1 });
      const post = createPost({
        id: 1,
        createdBy: createUserEntity({ id: 1 }),
      });
      postRepository.findOne = jest.fn().mockResolvedValue(post);
      postRepository.softDelete = jest.fn().mockResolvedValue({
        raw: [],
        affected: 0,
        generatedMaps: [],
      } satisfies UpdateResult);

      await expect(service.delete(post.id, user)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should allow admin to delete regardless of ownership', async () => {
      const board = createBoard({ requiredRole: UserRole.USER });
      const post = createPost({
        board,
        createdBy: createUserEntity({ id: 2, role: UserRole.USER }),
      });
      jest.spyOn(service, 'findById').mockResolvedValue(post);
      postRepository.softDelete = jest.fn().mockResolvedValue({
        raw: [],
        affected: 1,
        generatedMaps: [],
      } satisfies UpdateResult);
      const adminUser = createUserEntity({ id: 1, role: UserRole.ADMIN });

      await service.delete(post.id, adminUser);
      expect(commentsService.softDeletePostComments).toHaveBeenCalledWith(
        post.id,
      );
      expect(postRepository.softDelete).toHaveBeenCalled();
    });

    it('should delete the post if authorized', async () => {
      const user = createUserEntity({ id: 1 });
      const post = createPost({
        id: 1,
        createdBy: user,
      });
      postRepository.findOne = jest.fn().mockResolvedValue(post);
      postRepository.softDelete = jest.fn().mockResolvedValue({
        raw: [],
        affected: 1,
        generatedMaps: [],
      } satisfies UpdateResult);

      await expect(service.delete(post.id, user)).resolves.toBeUndefined();
      expect(commentsService.softDeletePostComments).toHaveBeenCalledWith(
        post.id,
      );
      expect(postRepository.softDelete).toHaveBeenCalledWith(1);
    });
  });

  describe('findRecentPosts', () => {
    it('should exclude specified slugs and filter by boardIds', async () => {
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
      const boardIds = [10, 20];
      const excludedSlugs = ['notices', 'secret'];
      const limit = 5;

      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPosts),
      };

      jest
        .spyOn(postRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilderMock as any);

      const result = await service.findRecentPosts(
        boardIds,
        limit,
        excludedSlugs,
      );

      expect(postRepository.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'categorySlug.slug NOT IN (:...excludedSlugs)',
        { excludedSlugs },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'board.id IN (:...boardIds)',
        { boardIds },
      );
      expect(queryBuilderMock.take).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockPosts.map(PostResponseDto.fromEntity));
    });
  });

  describe('findPostsByBoardId', () => {
    it('should return paginated posts in the specified board', async () => {
      const boardId = 1;
      const board = createBoard({ id: boardId });
      const mockPosts = [
        createPost({ id: 1, title: 'Post 1', board: board }),
        createPost({ id: 2, title: 'Post 2', board: board }),
      ] satisfies Post[];

      const paginationDto: PaginationDto = {
        page: 1,
        limit: 10,
        sort: 'createdAt',
        order: 'DESC',
      };

      const totalItems = mockPosts.length;

      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockPosts, totalItems]),
      };

      jest
        .spyOn(postRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilderMock as any);

      const result = await service.findPostsByBoardId(boardId, paginationDto);

      expect(postRepository.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'post.board.id = :boardId',
        { boardId },
      );
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith(
        'post.createdAt',
        'DESC',
      );
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0);
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
      expect(queryBuilderMock.getManyAndCount).toHaveBeenCalled();

      expect(result).toEqual({
        data: mockPosts.map(PostResponseDto.fromEntity),
        currentPage: paginationDto.page,
        totalItems,
        totalPages: Math.ceil(totalItems / paginationDto.limit!),
      });
    });

    it('should return empty paginated result when board has no posts', async () => {
      const boardId = 999;
      const paginationDto: PaginationDto = { page: 1, limit: 10 };

      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      jest
        .spyOn(postRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilderMock as any);

      const result = await service.findPostsByBoardId(boardId, paginationDto);

      expect(postRepository.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'post.board.id = :boardId',
        { boardId },
      );
      expect(queryBuilderMock.getManyAndCount).toHaveBeenCalled();

      expect(result).toEqual({
        data: [],
        currentPage: paginationDto.page,
        totalItems: 0,
        totalPages: 0,
      });
    });
  });

  describe('findPostsByBoardSlug', () => {
    it('should return all posts in the specified board', async () => {
      const board = createBoard({
        categorySlug: createCategorySlug({ slug: 'notices' }),
      });
      const mockPosts = [
        createPost({ id: 1, title: 'Post 1', board: board }),
        createPost({ id: 2, title: 'Post 2', board: board }),
      ] satisfies Post[];

      postRepository.find = jest.fn().mockResolvedValue(mockPosts);

      const result = await service.findPostsByBoardSlug(
        board.categorySlug.slug,
      );

      expect(postRepository.find).toHaveBeenCalledWith({
        where: { board: { categorySlug: { slug: board.categorySlug.slug } } },
        relations: {
          createdBy: true,
          board: {
            categorySlug: true,
          },
        },
      });
      expect(result).toEqual(mockPosts.map(PostResponseDto.fromEntity));
    });

    it('should return empty array when board has no posts', async () => {
      postRepository.find = jest.fn().mockResolvedValue([]);
      const result = await service.findPostsByBoardSlug('non-existed');
      expect(result).toEqual([]);
    });
  });

  describe('updateHotScores', () => {
    it('should update hot scores for all posts based on the formula', async () => {
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

      await service.updateHotScores();

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

    it('should throw InternalServerErrorException on save failure', async () => {
      const posts = [createPost({ id: 1 })];
      postRepository.find = jest.fn().mockResolvedValue(posts);
      postRepository.save = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(service.updateHotScores()).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update post 1:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('findPopularPosts', () => {
    it('should exclude specified slugs when provided', async () => {
      const mockPosts = [
        createPost({
          id: 1,
          title: 'Hot Post 1',
          hotScore: 100,
          board: createBoard({ id: 1, name: 'Board 1' }),
        }),
        createPost({
          id: 2,
          title: 'Hot Post 2',
          hotScore: 90,
          board: createBoard({ id: 2, name: 'Board 2' }),
        }),
      ];
      const excludedSlugs = ['notices'];

      const queryBuilderMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPosts),
      };

      jest
        .spyOn(postRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilderMock as any);

      const result = await service.findPopularPosts(excludedSlugs);

      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'categorySlug.slug NOT IN (:...excludedSlugs)',
        { excludedSlugs },
      );
      expect(queryBuilderMock.orderBy).toHaveBeenCalledWith(
        'post.hotScore',
        'DESC',
      );
      expect(result).toEqual(mockPosts.map(PostResponseDto.fromEntity));
    });
  });

  describe('createScrapedPost', () => {
    it('should create scraped post with YouTube data', async () => {
      const mockData: CreateScrapedVideoDto = new VideoFactory().create();

      const board = createBoard({
        categorySlug: createCategorySlug({ slug: 'video-board' }),
        type: BoardPurpose.AI_DIGEST,
      });

      const systemUser = createUserEntity({
        id: 1,
        role: UserRole.BOT,
      });
      systemUser.nickname = 'BOT';

      jest.spyOn(boardsService, 'findOne').mockResolvedValue(board);
      jest.spyOn(boardsService, 'validateBoardType').mockResolvedValue();

      const savedPost = createPost({
        type: PostOrigin.SCRAPED,
        channelTitle: mockData.channelTitle,
        duration: mockData.duration,
        source: 'YouTube',
        videoUrl: `https://www.youtube.com/watch?v=${mockData.youtubeId}`,
        board: board,
        createdBy: systemUser,
      });

      postRepository.create = jest.fn().mockReturnValue(savedPost);
      postRepository.save = jest.fn().mockResolvedValueOnce(savedPost);

      const result = await service.createScrapedPost(
        mockData,
        'video-board',
        systemUser,
      );

      expect(result.type).toBe(PostOrigin.SCRAPED);
      expect(boardsService.validateBoardType).toHaveBeenCalledWith(
        'video-board',
        BoardPurpose.AI_DIGEST,
      );
    });
  });

  describe('incrementCommentCount', () => {
    it('should increment comment count for existing post', async () => {
      const postId = 1;

      await service.incrementCommentCount(postId);

      expect(postRepository.increment).toHaveBeenCalledWith(
        { id: postId },
        'commentsCount',
        1,
      );
    });

    it('should handle multiple increments correctly', async () => {
      const postId = 1;

      await service.incrementCommentCount(postId);
      await service.incrementCommentCount(postId);
      await service.incrementCommentCount(postId);

      expect(postRepository.increment).toHaveBeenCalledTimes(3);
      expect(postRepository.increment).toHaveBeenCalledWith(
        { id: postId },
        'commentsCount',
        1,
      );
    });
  });

  describe('decrementCommentCountBulk', () => {
    beforeEach(() => {
      jest
        .spyOn(postRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      mockQueryBuilder.update.mockClear();
      mockQueryBuilder.set.mockClear();
      mockQueryBuilder.where.mockClear();
      mockQueryBuilder.execute.mockClear();
    });

    it('should do nothing if count is less than or equal to zero', async () => {
      const postId = 1;
      const count = 0;

      await service.decrementCommentCountBulk(postId, count);

      expect(postRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should decrement comment count by the specified count for an existing post with sufficient comments', async () => {
      const postId = 1;
      const countToDecrement = 3;
      const initialCommentsCount = 5;

      const mockPost = createPost({
        id: postId,
        commentsCount: initialCommentsCount,
      });

      jest.spyOn(postRepository, 'findOne').mockResolvedValue(mockPost);

      await service.decrementCommentCountBulk(postId, countToDecrement);

      expect(postRepository.createQueryBuilder).toHaveBeenCalledWith();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Post);

      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          commentsCount: expect.any(Function),
        }),
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: postId,
      });

      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should decrement comment count to zero if count to decrement exceeds current count', async () => {
      const postId = 1;
      const countToDecrement = 3;
      const initialCommentsCount = 1;

      const mockPost = createPost({
        id: postId,
        commentsCount: initialCommentsCount,
      });

      jest.spyOn(postRepository, 'findOne').mockResolvedValue(mockPost);

      await service.decrementCommentCountBulk(postId, countToDecrement);

      expect(postRepository.createQueryBuilder).toHaveBeenCalledWith();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Post);

      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          commentsCount: expect.any(Function),
        }),
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: postId,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });

    it('should throw NotFoundException when post does not exist', async () => {
      const postId = 999;
      const countToDecrement = 1;

      jest.spyOn(postRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.decrementCommentCountBulk(postId, countToDecrement),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(mockQueryBuilder.set).not.toHaveBeenCalled();
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(mockQueryBuilder.execute).not.toHaveBeenCalled();
    });

    it('should handle multiple decrements correctly', async () => {
      const postId = 1;
      const initialCount = 5;
      const firstDecrement = 2;
      const secondDecrement = 2;

      const mockPost = createPost({ id: postId, commentsCount: initialCount });

      jest.spyOn(postRepository, 'findOne').mockResolvedValue(mockPost);

      await service.decrementCommentCountBulk(postId, firstDecrement);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Post);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          commentsCount: expect.any(Function),
        }),
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: postId,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      await service.decrementCommentCountBulk(postId, secondDecrement);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Post);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          commentsCount: expect.any(Function),
        }),
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: postId,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('likePost', () => {
    it('should throw NotFoundException when post does not exist', async () => {
      const postId = 999;
      const user = createUserEntity({ id: 1 });

      jest.spyOn(postRepository, 'findOne').mockResolvedValue(null);

      await expect(service.likePost(postId, user)).rejects.toThrow(
        NotFoundException,
      );
      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: postId },
      });
      expect(postLikeRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return existing like status when user already liked the post', async () => {
      const postId = 1;
      const user = createUserEntity({ id: 1 });
      const post = createPost({ id: postId, likesCount: 5 });

      jest.spyOn(postRepository, 'findOne').mockResolvedValue(post);
      jest.spyOn(postLikeRepository, 'findOne').mockResolvedValue({
        userId: user.id,
        postId: postId,
        createdAt: new Date(),
      } as any);

      const result = await service.likePost(postId, user);

      expect(result).toEqual({
        postId: postId,
        likesCount: 5,
        isAdded: false,
      });
      expect(postLikeRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          postId: postId,
        },
      });
      expect(postRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(postLikeRepository.save).not.toHaveBeenCalled();
    });

    it('should add new like and increment likesCount when user not liked yet', async () => {
      const postId = 1;
      const user = createUserEntity({ id: 1 });
      const post = createPost({ id: postId, likesCount: 5 });

      jest
        .spyOn(postRepository, 'findOne')
        .mockResolvedValueOnce(post)
        .mockResolvedValueOnce({
          ...post,
          likesCount: 6,
        } as any);
      jest.spyOn(postLikeRepository, 'findOne').mockResolvedValue(null);

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      jest
        .spyOn(postRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      jest.spyOn(postLikeRepository, 'save').mockResolvedValue(undefined);

      const result = await service.likePost(postId, user);

      expect(result).toEqual({
        postId: postId,
        likesCount: 6,
        isAdded: true,
      });

      expect(postLikeRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          postId: postId,
        },
      });

      expect(postLikeRepository.save).toHaveBeenCalledWith({
        userId: user.id,
        postId: postId,
      });

      expect(postRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Post);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        likesCount: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: postId,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      expect(postRepository.findOne).toHaveBeenCalledWith({
        where: { id: postId },
        select: ['likesCount'],
      });
    });
  });
});
