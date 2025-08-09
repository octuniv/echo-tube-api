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

const mockQueryBuilder = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

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
        where: { id: mockComment.id },
        relations: ['createdBy'],
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
        where: { id: mockComment.id },
        relations: ['createdBy'],
      });
      expect(commentRepository.save).not.toHaveBeenCalled();
    });

    it('타인이 작성한 댓글 수정 시도 시 403 Forbidden 응답 확인', async () => {
      const anotherUser = createUserEntity({ id: 10 });
      jest.spyOn(commentRepository, 'findOne').mockResolvedValue(mockComment);

      await expect(
        service.update(mockComment.id, { content: 'Updated' }, anotherUser),
      ).rejects.toThrow(ForbiddenException);

      expect(commentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockComment.id },
        relations: ['createdBy'],
      });
      expect(commentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('toggleLike', () => {
    beforeEach(() => {
      jest
        .spyOn(commentRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      mockQueryBuilder.update.mockClear();
      mockQueryBuilder.set.mockClear();
      mockQueryBuilder.where.mockClear();
      mockQueryBuilder.execute.mockClear();
    });

    const mockUser = createUserEntity();
    const mockComment = createComment({ id: 1, likes: 0 });

    it('should add like to comment', async () => {
      const commentWithLike = { ...mockComment, likes: 1 };
      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValueOnce(mockComment as any)
        .mockResolvedValue(commentWithLike as any);
      jest.spyOn(commentLikeRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(commentLikeRepository, 'save').mockResolvedValue({} as any);

      mockQueryBuilder.execute.mockResolvedValue({} as any);

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

      expect(commentRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Comment);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        likes: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: mockComment.id,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      expect(commentRepository.findOne).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ likes: 1 });
    });

    it('should remove like from comment', async () => {
      const existingLike = { userId: mockUser.id, commentId: mockComment.id };
      const commentWithLike = { ...mockComment, likes: 1 };
      jest
        .spyOn(commentRepository, 'findOne')
        .mockResolvedValueOnce(commentWithLike as any)
        .mockResolvedValue(mockComment as any);
      jest
        .spyOn(commentLikeRepository, 'findOne')
        .mockResolvedValue(existingLike as any);
      jest.spyOn(commentLikeRepository, 'delete').mockResolvedValue({} as any);

      mockQueryBuilder.execute.mockResolvedValue({} as any);

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

      expect(commentRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Comment);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        likes: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: mockComment.id,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      expect(commentRepository.findOne).toHaveBeenCalledTimes(2);
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
        .mockResolvedValueOnce(commentWithOneLike as any)
        .mockResolvedValue({ ...mockComment, likes: 0 } as any);
      jest.spyOn(commentLikeRepository, 'findOne').mockResolvedValue({} as any);
      jest.spyOn(commentLikeRepository, 'delete').mockResolvedValue({} as any);
      mockQueryBuilder.execute.mockResolvedValue({} as any);

      const result = await service.toggleLike(mockComment.id, mockUser);

      expect(commentRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Comment);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        likes: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', {
        id: mockComment.id,
      });
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      expect(result).toEqual({ likes: 0 });
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

  describe('getPagedCommentsFlat', () => {
    const postId = 1;
    const mockUser = createUserEntity({ id: 1, nickname: 'testUser' });
    const mockPost = createPost({ id: postId });
    const threadsPerPage = 10;

    beforeEach(() => {
      jest.spyOn(commentRepository, 'findAndCount').mockClear();
    });

    it('should return paginated comments with replies', async () => {
      const topLevelComments = [
        createComment({
          id: 1,
          content: 'Top comment 1',
          createdBy: mockUser,
          post: mockPost,
          children: [
            createComment({
              id: 2,
              content: 'Reply 1',
              createdBy: mockUser,
              post: mockPost,
              parent: { id: 1 } as any,
            }),
            createComment({
              id: 3,
              content: 'Reply 2',
              createdBy: mockUser,
              post: mockPost,
              parent: { id: 1 } as any,
            }),
          ],
        }),
        createComment({
          id: 4,
          content: 'Top comment 2',
          createdBy: mockUser,
          post: mockPost,
          children: [],
        }),
      ];

      const totalTopLevelCount = 10;

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue([topLevelComments, totalTopLevelCount]);

      const result = await service.getPagedCommentsFlat(postId, 1);

      expect(commentRepository.findAndCount).toHaveBeenCalledWith({
        where: { post: { id: postId }, parent: null },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: threadsPerPage,
        relations: {
          createdBy: true,
          children: {
            createdBy: true,
          },
        },
      });

      expect(result.data).toHaveLength(4);

      expect(result.data[0].id).toBe(1);
      expect(result.data[0].content).toBe('Top comment 1');
      expect(result.data[0].parentId).toBeNull();
      expect(result.data[0].hasReplies).toBeTruthy();

      expect(result.data[1].id).toBe(2);
      expect(result.data[1].content).toBe('Reply 1');
      expect(result.data[1].parentId).toBe(1);
      expect(result.data[1].hasReplies).toBeFalsy();

      expect(result.data[2].id).toBe(3);
      expect(result.data[2].content).toBe('Reply 2');
      expect(result.data[2].parentId).toBe(1);
      expect(result.data[2].hasReplies).toBeFalsy();

      expect(result.data[3].id).toBe(4);
      expect(result.data[3].content).toBe('Top comment 2');
      expect(result.data[3].parentId).toBeNull();
      expect(result.data[3].hasReplies).toBeFalsy();

      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(totalTopLevelCount);
      expect(result.totalPages).toBe(
        Math.ceil(totalTopLevelCount / threadsPerPage),
      );
    });

    it('should sort children comments by createdAt in ascending order', async () => {
      const olderDate = new Date(Date.now() - 1000);
      const newerDate = new Date();

      const topLevelComment = createComment({
        id: 1,
        content: 'Top comment',
        createdBy: mockUser,
        post: mockPost,
        children: [
          createComment({
            id: 2,
            content: 'Newer reply',
            createdBy: mockUser,
            post: mockPost,
            parent: { id: 1 } as any,
            createdAt: newerDate,
          }),
          createComment({
            id: 3,
            content: 'Older reply',
            createdBy: mockUser,
            post: mockPost,
            parent: { id: 1 } as any,
            createdAt: olderDate,
          }),
        ],
      });

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue([[topLevelComment], 1]);

      const result = await service.getPagedCommentsFlat(postId, 1);

      expect(result.data).toHaveLength(3);

      expect(result.data[0].id).toBe(1);

      expect(result.data[1].id).toBe(3);
      expect(result.data[2].id).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      const page = 2;
      const skip = (page - 1) * threadsPerPage;

      const topLevelComments = [
        createComment({ id: 11, createdBy: mockUser, post: mockPost }),
      ];
      const totalTopLevelCount = 15;

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue([topLevelComments, totalTopLevelCount]);

      const result = await service.getPagedCommentsFlat(postId, page);

      expect(commentRepository.findAndCount).toHaveBeenCalledWith({
        where: { post: { id: postId }, parent: null },
        order: { createdAt: 'DESC' },
        skip,
        take: threadsPerPage,
        relations: {
          createdBy: true,
          children: {
            createdBy: true,
          },
        },
      });

      expect(result.currentPage).toBe(page);
      expect(result.totalItems).toBe(totalTopLevelCount);
      expect(result.totalPages).toBe(
        Math.ceil(totalTopLevelCount / threadsPerPage),
      );
      expect(result.data).toHaveLength(1);
    });

    it('should return empty array when there are no comments', async () => {
      jest.spyOn(commentRepository, 'findAndCount').mockResolvedValue([[], 0]);

      const result = await service.getPagedCommentsFlat(postId, 1);

      expect(result.data).toHaveLength(0);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should correctly set hasReplies property', async () => {
      const topLevelCommentWithReplies = createComment({
        id: 1,
        content: 'Has replies',
        createdBy: mockUser,
        post: mockPost,
        children: [
          createComment({
            id: 2,
            createdBy: mockUser,
            post: mockPost,
            parent: { id: 1 } as any,
          }),
        ],
      });

      const topLevelCommentWithoutReplies = createComment({
        id: 3,
        content: 'No replies',
        createdBy: mockUser,
        post: mockPost,
        children: [],
      });

      jest
        .spyOn(commentRepository, 'findAndCount')
        .mockResolvedValue([
          [topLevelCommentWithReplies, topLevelCommentWithoutReplies],
          2,
        ]);

      const result = await service.getPagedCommentsFlat(postId, 1);

      expect(result.data).toHaveLength(3);
      expect(result.data[0].hasReplies).toBeTruthy();
      expect(result.data[1].hasReplies).toBeFalsy();
      expect(result.data[2].hasReplies).toBeFalsy();
    });
  });

  describe('remove', () => {
    const mockPost = createPost({ id: 1 });
    const mockUser = createUserEntity({ id: 1 });
    const mockOtherUser = createUserEntity({ id: 2 });
    const mockAdminUser = createUserEntity({ id: 3, role: UserRole.ADMIN });
    let mockParentComment: Comment;
    let mockChildComment1: Comment;
    let mockChildComment2: Comment;

    const parentId = 1;
    const childId1 = 2;
    const childId2 = 3;

    beforeEach(() => {
      mockParentComment = createComment({
        id: parentId,
        content: 'Parent Comment',
        post: mockPost,
        createdBy: mockUser,
        children: [],
      });

      mockChildComment1 = createComment({
        id: childId1,
        content: 'Child Comment 1',
        post: mockPost,
        createdBy: mockUser,
        parent: mockParentComment,
      });

      mockChildComment2 = createComment({
        id: childId2,
        content: 'Child Comment 2',
        post: mockPost,
        createdBy: mockUser,
        parent: mockParentComment,
      });

      mockParentComment.children = [mockChildComment1, mockChildComment2];

      jest.spyOn(commentRepository, 'findOne').mockClear();
      jest.spyOn(commentRepository, 'softDelete').mockClear();
      jest.spyOn(postsService, 'decrementCommentCountBulk').mockClear();
    });

    describe('정상적인 댓글 삭제 시나리오', () => {
      it('소유자가 자신의 댓글(자식 없음)을 성공적으로 삭제해야 함', async () => {
        const mockCommentNoChildren = { ...mockParentComment, children: [] };
        jest
          .spyOn(commentRepository, 'findOne')
          .mockResolvedValue(mockCommentNoChildren as Comment);
        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 1 } as any);

        const result = await service.remove(parentId, mockUser);

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: parentId },
          relations: ['post', 'createdBy', 'children'],
        });

        expect(postsService.decrementCommentCountBulk).toHaveBeenCalledWith(
          mockPost.id,
          1,
        );

        expect(commentRepository.softDelete).toHaveBeenCalledWith({
          id: In([parentId]),
        });

        expect(result).toEqual({
          message: COMMENT_MESSAGES.DELETED,
          id: parentId,
        });
      });

      it('소유자가 자신의 댓글(자식 있음)을 성공적으로 삭제해야 함 (부모+자식 모두 삭제)', async () => {
        jest
          .spyOn(commentRepository, 'findOne')
          .mockResolvedValue(mockParentComment);

        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 3 } as any);

        const result = await service.remove(parentId, mockUser);

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: parentId },
          relations: ['post', 'createdBy', 'children'],
        });

        expect(postsService.decrementCommentCountBulk).toHaveBeenCalledWith(
          mockPost.id,
          3,
        );

        expect(commentRepository.softDelete).toHaveBeenCalledWith({
          id: In([parentId, childId1, childId2]),
        });

        expect(result).toEqual({
          message: COMMENT_MESSAGES.DELETED,
          id: parentId,
        });
      });

      it('관리자는 다른 사용자의 댓글(자식 있음)을 성공적으로 삭제해야 함', async () => {
        jest
          .spyOn(commentRepository, 'findOne')
          .mockResolvedValue(mockParentComment);

        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 3 } as any);

        const result = await service.remove(parentId, mockAdminUser);

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: parentId },
          relations: ['post', 'createdBy', 'children'],
        });

        expect(postsService.decrementCommentCountBulk).toHaveBeenCalledWith(
          mockPost.id,
          3,
        );

        expect(commentRepository.softDelete).toHaveBeenCalledWith({
          id: In([parentId, childId1, childId2]),
        });

        expect(result).toEqual({
          message: COMMENT_MESSAGES.DELETED,
          id: parentId,
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
          relations: ['post', 'createdBy', 'children'],
        });
        expect(postsService.decrementCommentCountBulk).not.toHaveBeenCalled();
        expect(commentRepository.softDelete).not.toHaveBeenCalled();
      });

      it('일반 사용자가 다른 사용자의 댓글을 삭제하려고 하면 ForbiddenException이 발생해야 함', async () => {
        const otherUserParentComment = createComment({
          id: 4,
          content: 'Other User Comment',
          post: mockPost,
          createdBy: mockOtherUser,
          children: [],
        });
        jest
          .spyOn(commentRepository, 'findOne')
          .mockResolvedValue(otherUserParentComment);
        await expect(
          service.remove(otherUserParentComment.id, mockUser),
        ).rejects.toThrow(new ForbiddenException(COMMENT_ERRORS.NO_PERMISSION));

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: otherUserParentComment.id },
          relations: ['post', 'createdBy', 'children'],
        });
        expect(postsService.decrementCommentCountBulk).not.toHaveBeenCalled();
        expect(commentRepository.softDelete).not.toHaveBeenCalled();
      });

      it('데이터베이스에서 댓글 삭제에 실패하면(affected != expected) InternalServerErrorException이 발생해야 함', async () => {
        jest
          .spyOn(commentRepository, 'findOne')
          .mockResolvedValue(mockParentComment);
        jest
          .spyOn(commentRepository, 'softDelete')
          .mockResolvedValue({ affected: 2 } as any);

        await expect(service.remove(parentId, mockUser)).rejects.toThrow(
          new InternalServerErrorException(
            `댓글 삭제 중 문제가 발생했습니다. 예상 삭제 수: 3, 실제 삭제 수: 2`,
          ),
        );

        expect(commentRepository.findOne).toHaveBeenCalledWith({
          where: { id: parentId },
          relations: ['post', 'createdBy', 'children'],
        });

        expect(postsService.decrementCommentCountBulk).toHaveBeenCalledWith(
          mockPost.id,
          3,
        );
        expect(commentRepository.softDelete).toHaveBeenCalledWith({
          id: In([parentId, childId1, childId2]),
        });
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
          relations: ['post', 'createdBy', 'children'],
        });
      });
    });
  });
});
