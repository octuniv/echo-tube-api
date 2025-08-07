import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { In, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/commentLike.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { PostsService } from '../posts.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { createComment } from './factories/comments.factory';
import { createPost } from '../factories/post.factory';
import { createUserEntity } from '@/users/factory/user.factory';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepository: Repository<Comment>;
  let commentLikeRepository: Repository<CommentLike>;
  let postsService: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: createMock<Repository<Comment>>(),
        },
        {
          provide: getRepositoryToken(CommentLike),
          useValue: createMock<Repository<CommentLike>>(),
        },
        {
          provide: PostsService,
          useValue: createMock<PostsService>(),
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    commentRepository = module.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );
    commentLikeRepository = module.get<Repository<CommentLike>>(
      getRepositoryToken(CommentLike),
    );
    postsService = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const mockUser = createUserEntity();
    const mockPost = createPost();
    const createCommentDto: CreateCommentDto = {
      content: 'Test Comment',
      postId: 1,
    };

    beforeEach(() => {
      jest.spyOn(postsService, 'findById').mockResolvedValue(mockPost);
      jest
        .spyOn(postsService, 'incrementCommentCount')
        .mockResolvedValue(undefined);
    });

    it('should create a comment successfully', async () => {
      const mockComment = createComment({ content: createCommentDto.content });
      jest
        .spyOn(commentRepository, 'create')
        .mockReturnValue(mockComment as any);
      jest.spyOn(commentRepository, 'save').mockResolvedValue(mockComment);

      const result = await service.create(createCommentDto, mockUser);

      expect(postsService.findById).toHaveBeenCalledWith(
        createCommentDto.postId,
      );
      expect(commentRepository.create).toHaveBeenCalledWith({
        content: createCommentDto.content,
        post: mockPost,
        createdBy: mockUser,
        parent: null,
      });
      expect(postsService.incrementCommentCount).toHaveBeenCalledWith(
        createCommentDto.postId,
      );
      expect(commentRepository.save).toHaveBeenCalledWith(mockComment);
      expect(result).toEqual(mockComment);
    });

    it('should throw NotFoundException when post does not exist', async () => {
      jest.spyOn(postsService, 'findById').mockResolvedValue(null);

      await expect(service.create(createCommentDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );

      expect(postsService.findById).toHaveBeenCalledWith(
        createCommentDto.postId,
      );
      expect(postsService.incrementCommentCount).not.toHaveBeenCalled();
      expect(commentRepository.create).not.toHaveBeenCalled();
    });

    it('should create a reply (nested comment) successfully', async () => {
      const parentId = 2;
      const mockParentComment = createComment({ id: parentId });
      const replyDto = { ...createCommentDto, parentId };

      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValueOnce(mockParentComment);

      jest
        .spyOn(commentRepository, 'create')
        .mockReturnValue(createComment({ content: replyDto.content }));

      await service.create(replyDto, mockUser);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: parentId },
        relations: ['parent'],
      });
      expect(commentRepository.create).toHaveBeenCalledWith({
        content: replyDto.content,
        post: mockPost,
        createdBy: mockUser,
        parent: mockParentComment,
      });
    });

    it('should throw NotFoundException when parent comment does not exist', async () => {
      const parentId = 999;
      const replyDto = { ...createCommentDto, parentId };

      jest.spyOn(postsService, 'findById').mockResolvedValue(mockPost);
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(null);

      await expect(service.create(replyDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: parentId },
        relations: ['parent'],
      });
    });

    it('should throw BadRequestException when trying to reply to a reply (3rd level)', async () => {
      const parentId = 3;
      const mockParentComment = createComment({
        id: parentId,
        parent: { id: 2 } as any,
      });
      const replyDto = { ...createCommentDto, parentId };

      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValue(mockParentComment);

      await expect(service.create(replyDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: parentId },
        relations: ['parent'],
      });
    });
  });

  describe('update', () => {
    const mockUser = createUserEntity();
    const mockComment = createComment({
      id: 1,
      content: 'Original Comment',
      createdBy: mockUser,
    });

    it('should update comment successfully', async () => {
      const updateDto: UpdateCommentDto = { content: 'Updated Comment' };
      const updatedComment = { ...mockComment, content: updateDto.content };

      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);
      jest
        .spyOn(commentRepository, 'save')
        .mockResolvedValue(updatedComment as any);

      const result = await service.update(mockComment.id, updateDto, mockUser);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id, createdBy: { id: mockUser.id } },
        relations: ['post'],
      });
      expect(commentRepository.save).toHaveBeenCalledWith(updatedComment);
      expect(result).toEqual(updatedComment);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update(mockComment.id, { content: 'Updated' }, mockUser),
      ).rejects.toThrow(NotFoundException);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id, createdBy: { id: mockUser.id } },
        relations: ['post'],
      });
      expect(commentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const mockUser = createUserEntity();
    const mockPost = createPost();
    const mockComment = createComment({
      id: 1,
      content: 'Test Comment',
      post: mockPost,
      createdBy: mockUser,
    });

    beforeEach(() => {
      jest
        .spyOn(postsService, 'decrementCommentCount')
        .mockResolvedValue(undefined);
    });

    it('should remove comment successfully', async () => {
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);
      jest.spyOn(commentRepository, 'softDelete').mockResolvedValue({} as any);

      await service.remove(mockComment.id, mockUser);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id, createdBy: { id: mockUser.id } },
        relations: ['post'],
      });
      expect(postsService.decrementCommentCount).toHaveBeenCalledWith(
        mockPost.id,
      );
      expect(commentRepository.softDelete).toHaveBeenCalledWith(mockComment.id);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove(mockComment.id, mockUser)).rejects.toThrow(
        NotFoundException,
      );

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id, createdBy: { id: mockUser.id } },
        relations: ['post'],
      });
      expect(postsService.decrementCommentCount).not.toHaveBeenCalled();
      expect(commentRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should handle transaction correctly when removing comment', async () => {
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);

      await service.remove(mockComment.id, mockUser);

      expect(postsService.decrementCommentCount).toHaveBeenCalledWith(
        mockPost.id,
      );
      expect(commentRepository.softDelete).toHaveBeenCalledWith(mockComment.id);
    });
  });

  describe('getPagedCommentsFlat', () => {
    const mockPostId = 1;
    const mockPaginationDto: PaginationDto = { page: 1, limit: 10 };

    it('should return paginated comments with necessary parent comments', async () => {
      const mockComments = [
        createComment({ id: 1, content: 'Comment 1' }),
        createComment({
          id: 2,
          content: 'Reply to Comment 3',
          parent: { id: 3 } as any,
        }),
        createComment({ id: 4, content: 'Comment 4' }),
      ];

      const mockParentComment = createComment({
        id: 3,
        content: 'Comment 3 (Parent)',
      });

      const mockFindAndCountResult: [Comment[], number] = [
        mockComments,
        mockComments.length + 1,
      ];

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue(mockFindAndCountResult);
      jest
        .spyOn(commentRepository, 'find')
        .mockResolvedValue([mockParentComment]);

      const result: PaginatedResponseDto<Comment> =
        await service.getPagedCommentsFlat(mockPostId, mockPaginationDto);

      expect(commentRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          post: { id: mockPostId },
        },
        relations: ['createdBy', 'parent'],
        order: { createdAt: 'ASC' },
        skip: 0,
        take: 10,
      });

      expect(commentRepository.find).toHaveBeenCalledWith({
        where: {
          id: In([3]),
        },
        relations: ['createdBy'],
      });

      expect(result.data).toHaveLength(4);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(4);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty comments', async () => {
      jest.spyOn(commentRepository, 'findAndCount').mockResolvedValue([[], 0]);

      const result: PaginatedResponseDto<Comment> =
        await service.getPagedCommentsFlat(mockPostId, mockPaginationDto);

      expect(result.data).toHaveLength(0);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle case with no missing parent comments', async () => {
      const mockComments = [
        createComment({ id: 1, content: 'Comment 1' }),
        createComment({ id: 2, content: 'Comment 2' }),
      ];

      const mockFindAndCountResult: [Comment[], number] = [
        mockComments,
        mockComments.length,
      ];

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue(mockFindAndCountResult);

      const result: PaginatedResponseDto<Comment> =
        await service.getPagedCommentsFlat(mockPostId, mockPaginationDto);

      expect(commentRepository.find).not.toHaveBeenCalled();

      expect(result.data).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should handle case with no missing parent comments', async () => {
      const mockComments = [
        createComment({ id: 1, content: 'Comment 1' }),
        createComment({ id: 2, content: 'Comment 2' }),
      ];

      const mockFindAndCountResult: [Comment[], number] = [
        mockComments,
        mockComments.length,
      ];

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue(mockFindAndCountResult);
      jest.spyOn(commentRepository, 'find').mockResolvedValue([]);

      const result: PaginatedResponseDto<Comment> =
        await service.getPagedCommentsFlat(mockPostId, mockPaginationDto);

      expect(commentRepository.find).not.toHaveBeenCalled();

      expect(result.data).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('toggleLike', () => {
    const mockUser = createUserEntity();
    const mockComment = createComment({ id: 1, likes: 0 });

    it('should add like to comment', async () => {
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);
      jest.spyOn(commentLikeRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(commentLikeRepository, 'save').mockResolvedValue({} as any);
      jest
        .spyOn(commentRepository, 'save')
        .mockResolvedValue({ ...mockComment, likes: 1 } as any);

      const result = await service.toggleLike(mockComment.id, mockUser);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id },
      });
      expect(commentLikeRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUser.id, commentId: mockComment.id },
      });
      expect(commentLikeRepository.save).toHaveBeenCalledWith({
        userId: mockUser.id,
        commentId: mockComment.id,
      });
      expect(commentRepository.save).toHaveBeenCalledWith({
        ...mockComment,
        likes: 1,
      });
      expect(result).toEqual({ likes: 1 });
    });

    it('should remove like from comment', async () => {
      const existingLike = { userId: mockUser.id, commentId: mockComment.id };
      const commentWithLike = { ...mockComment, likes: 1 };

      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValue(commentWithLike as any);
      jest
        .spyOn(commentLikeRepository, 'findOne')
        .mockResolvedValue(existingLike as any);
      jest.spyOn(commentLikeRepository, 'delete').mockResolvedValue({} as any);
      jest
        .spyOn(commentRepository, 'save')
        .mockResolvedValue(mockComment as any);

      const result = await service.toggleLike(mockComment.id, mockUser);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id },
      });
      expect(commentLikeRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUser.id, commentId: mockComment.id },
      });
      expect(commentLikeRepository.delete).toHaveBeenCalledWith({
        userId: mockUser.id,
        commentId: mockComment.id,
      });
      expect(commentRepository.save).toHaveBeenCalledWith({
        ...commentWithLike,
        likes: 0,
      });
      expect(result).toEqual({ likes: 0 });
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.toggleLike(mockComment.id, mockUser),
      ).rejects.toThrow(NotFoundException);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id },
      });
    });

    it('should handle like count correctly when decrementing from 1', async () => {
      const commentWithOneLike = { ...mockComment, likes: 1 };

      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValue(commentWithOneLike as any);
      jest.spyOn(commentLikeRepository, 'findOne').mockResolvedValue({} as any);
      jest.spyOn(commentLikeRepository, 'delete').mockResolvedValue({} as any);
      jest
        .spyOn(commentRepository, 'save')
        .mockResolvedValue({ ...commentWithOneLike, likes: 0 } as any);

      const result = await service.toggleLike(mockComment.id, mockUser);

      expect(result).toEqual({ likes: 0 });
      expect(commentRepository.save).toHaveBeenCalledWith({
        ...commentWithOneLike,
        likes: 0,
      });
    });

    it('should not allow negative like count', async () => {
      const commentWithZeroLikes = { ...mockComment, likes: 0 };

      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValue(commentWithZeroLikes as any);
      jest.spyOn(commentLikeRepository, 'findOne').mockResolvedValue({} as any);
      jest.spyOn(commentLikeRepository, 'delete').mockResolvedValue({} as any);
      jest
        .spyOn(commentRepository, 'save')
        .mockResolvedValue(commentWithZeroLikes as any);

      const result = await service.toggleLike(mockComment.id, mockUser);

      expect(result.likes).toBeGreaterThanOrEqual(0);
    });
  });
});
