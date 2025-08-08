import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { In, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/commentLike.entity';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { createComment } from './factories/comments.factory';
import { createUserEntity } from '@/users/factory/user.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import {
  COMMENT_ERRORS,
  COMMENT_MESSAGES,
} from './constants/comment.constants';
import { PostsService } from '@/posts/posts.service';
import { createPost } from '@/posts/factories/post.factory';

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
      expect(result).toEqual({
        message: COMMENT_MESSAGES.CREATED,
        id: mockComment.id,
      });
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
      expect(result).toEqual({
        message: COMMENT_MESSAGES.UPDATED,
        id: updatedComment.id,
      });
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
    const mockPost = createPost({ id: 1 });
    const mockUser = createUserEntity({ id: 1 });
    const mockOtherUser = createUserEntity({ id: 2 });
    const mockAdminUser = createUserEntity({ id: 3, role: UserRole.ADMIN });

    let mockComment: Comment;

    beforeEach(() => {
      mockComment = createComment({
        id: 1,
        content: 'Test Comment',
        post: mockPost,
        createdBy: mockUser,
      });

      jest.spyOn(commentRepository, 'findOne').mockClear();
      jest.spyOn(commentRepository, 'softDelete').mockClear();
      jest.spyOn(postsService, 'decrementCommentCount').mockClear();
    });

    describe('정상적인 댓글 삭제 시나리오', () => {
      it('소유자가 자신의 댓글을 성공적으로 삭제해야 함', async () => {
        jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);
        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 1 } as any);

        const result = await service.remove(mockComment.id, mockUser);

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: mockComment.id },
          relations: ['post', 'createdBy'],
        });
        expect(postsService.decrementCommentCount).toHaveBeenCalledWith(
          mockPost.id,
        );
        expect(commentRepository.softDelete).toHaveBeenCalledWith(
          mockComment.id,
        );
        expect(result).toEqual({
          message: COMMENT_MESSAGES.DELETED,
          id: mockComment.id,
        });
      });

      it('관리자는 다른 사용자의 댓글을 성공적으로 삭제해야 함', async () => {
        jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);
        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 1 } as any);

        const result = await service.remove(mockComment.id, mockAdminUser);

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: mockComment.id },
          relations: ['post', 'createdBy'],
        });
        expect(postsService.decrementCommentCount).toHaveBeenCalledWith(
          mockPost.id,
        );
        expect(commentRepository.softDelete).toHaveBeenCalledWith(
          mockComment.id,
        );
        expect(result).toEqual({
          message: COMMENT_MESSAGES.DELETED,
          id: mockComment.id,
        });
      });
    });

    describe('예외 처리 시나리오', () => {
      it('존재하지 않는 댓글을 삭제하려고 하면 NotFoundException이 발생해야 함', async () => {
        jest.spyOn(commentRepository, 'findOne').mockResolvedValue(null);

        await expect(service.remove(999, mockUser)).rejects.toThrow(
          new NotFoundException(COMMENT_ERRORS.NOT_FOUND),
        );

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: 999 },
          relations: ['post', 'createdBy'],
        });
        expect(postsService.decrementCommentCount).not.toHaveBeenCalled();
        expect(commentRepository.softDelete).not.toHaveBeenCalled();
      });

      it('일반 사용자가 다른 사용자의 댓글을 삭제하려고 하면 ForbiddenException이 발생해야 함', async () => {
        const otherUserComment = createComment({
          id: 2,
          content: 'Other User Comment',
          post: mockPost,
          createdBy: mockOtherUser,
        });

        jest
          .spyOn(commentRepository, 'findOne')
          .mockResolvedValue(otherUserComment);

        await expect(
          service.remove(otherUserComment.id, mockUser),
        ).rejects.toThrow(new ForbiddenException(COMMENT_ERRORS.NO_PERMISSION));

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: otherUserComment.id },
          relations: ['post', 'createdBy'],
        });
        expect(postsService.decrementCommentCount).not.toHaveBeenCalled();
        expect(commentRepository.softDelete).not.toHaveBeenCalled();
      });

      it('데이터베이스에서 댓글 삭제에 실패하면 InternalServerErrorException이 발생해야 함', async () => {
        jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);
        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 0 } as any);

        await expect(service.remove(mockComment.id, mockUser)).rejects.toThrow(
          new InternalServerErrorException('댓글 삭제 중 문제가 발생했습니다.'),
        );

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: mockComment.id },
          relations: ['post', 'createdBy'],
        });
        expect(postsService.decrementCommentCount).toHaveBeenCalledWith(
          mockPost.id,
        );
        expect(commentRepository.softDelete).toHaveBeenCalledWith(
          mockComment.id,
        );
      });
    });

    describe('에지 케이스 시나리오', () => {
      it('관리자가 존재하지 않는 댓글을 삭제하려고 해도 NotFoundException이 발생해야 함', async () => {
        jest.spyOn(commentRepository, 'findOne').mockResolvedValue(null);

        await expect(service.remove(999, mockAdminUser)).rejects.toThrow(
          new NotFoundException(COMMENT_ERRORS.NOT_FOUND),
        );

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: 999 },
          relations: ['post', 'createdBy'],
        });
      });
    });
  });

  describe('getPagedCommentsFlat', () => {
    const mockPostId = 1;
    const limit = 20;

    it('should return paginated comments with necessary parent comments', async () => {
      const mockComments = [
        createComment({
          id: 4,
          content: 'Comment 4',
          createdAt: new Date(2024, 0, 4),
        }),
        createComment({
          id: 2,
          content: 'Reply to Comment 3',
          parent: { id: 3 } as any,
          createdAt: new Date(2024, 0, 2),
        }),
        createComment({
          id: 1,
          content: 'Comment 1',
          createdAt: new Date(2024, 0, 1),
        }),
      ];

      const mockParentComment = createComment({
        id: 3,
        content: 'Comment 3 (Parent)',
        children: [{ id: 2 } as any],
        createdAt: new Date(2024, 0, 3),
      });

      const mockFindAndCountResult: [Comment[], number] = [mockComments, 4];

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue(mockFindAndCountResult);
      jest
        .spyOn(commentRepository, 'find')
        .mockResolvedValue([mockParentComment]);

      const page = 1;
      const result = await service.getPagedCommentsFlat(mockPostId, page);

      expect(commentRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          post: { id: mockPostId },
        },
        relations: ['createdBy', 'parent', 'children'],
        skip: 0,
        take: limit,
      });

      expect(commentRepository.find).toHaveBeenCalledWith({
        where: {
          id: In([3]),
        },
        relations: ['createdBy', 'children'],
      });

      expect(result.data).toHaveLength(4);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(4);
      expect(result.totalPages).toBe(1);

      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('content');
      expect(result.data[0]).toHaveProperty('likes');
      expect(result.data[0]).toHaveProperty('createdAt');
      expect(result.data[0]).toHaveProperty('updatedAt');
      expect(result.data[0]).toHaveProperty('nickname');
      expect(result.data[0]).toHaveProperty('parentId');
      expect(result.data[0]).toHaveProperty('hasReplies');

      expect(result.data[0].id).toBe(4);
      expect(result.data[1].id).toBe(3);
      expect(result.data[2].id).toBe(2);
      expect(result.data[3].id).toBe(1);

      expect(result.data[0].hasReplies).toBe(false);
      expect(result.data[1].hasReplies).toBe(true);
      expect(result.data[2].hasReplies).toBe(false);
      expect(result.data[3].hasReplies).toBe(false);
    });

    it('should handle pagination for second page', async () => {
      const mockComments = [
        createComment({
          id: 22,
          content: 'Comment 22',
          createdAt: new Date(2024, 0, 22),
        }),
        createComment({
          id: 21,
          content: 'Comment 21',
          createdAt: new Date(2024, 0, 21),
        }),
      ];

      const mockFindAndCountResult: [Comment[], number] = [mockComments, 25];
      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue(mockFindAndCountResult);

      const page = 2;
      const result = await service.getPagedCommentsFlat(mockPostId, page);

      expect(commentRepository.findAndCount).toHaveBeenCalledWith({
        where: {
          post: { id: mockPostId },
        },
        relations: ['createdBy', 'parent', 'children'],
        skip: 20,
        take: limit,
      });

      expect(result.data).toHaveLength(2);
      expect(result.currentPage).toBe(2);
      expect(result.totalItems).toBe(25);
      expect(result.totalPages).toBe(2);

      expect(result.data[0].id).toBe(22);
      expect(result.data[1].id).toBe(21);
    });

    it('should handle empty comments', async () => {
      jest.spyOn(commentRepository, 'findAndCount').mockResolvedValue([[], 0]);

      const page = 1;
      const result = await service.getPagedCommentsFlat(mockPostId, page);

      expect(result.data).toHaveLength(0);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle case with no missing parent comments', async () => {
      const mockComments = [
        createComment({
          id: 2,
          content: 'Comment 2',
          createdAt: new Date(2024, 0, 2),
          children: [],
        }),
        createComment({
          id: 1,
          content: 'Comment 1',
          createdAt: new Date(2024, 0, 1),
          children: [{ id: 2 } as any],
        }),
      ];

      const mockFindAndCountResult: [Comment[], number] = [
        mockComments,
        mockComments.length,
      ];

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue(mockFindAndCountResult);

      const page = 1;
      const result = await service.getPagedCommentsFlat(mockPostId, page);

      expect(commentRepository.find).not.toHaveBeenCalled();

      expect(result.data).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(2);
      expect(result.totalPages).toBe(1);

      expect(result.data[0].id).toBe(2);
      expect(result.data[1].id).toBe(1);

      expect(result.data[0].hasReplies).toBe(false);
      expect(result.data[1].hasReplies).toBe(true);
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
