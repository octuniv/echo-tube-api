import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { createMock } from '@golevelup/ts-jest';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  InternalServerErrorException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import {
  COMMENT_ERRORS,
  COMMENT_MESSAGES,
} from './constants/comment.constants';
import { CommentListItemDto } from './dto/comment-list-item.dto';
import { UserRole } from '@/users/entities/user-role.enum';

describe('CommentsController', () => {
  let app: INestApplication;
  let service: CommentsService;
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    role: UserRole.USER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: createMock<CommentsService>(),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { ...mockUser };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      (app as any) = null;
    }
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a comment successfully', async () => {
      const createDto: CreateCommentDto = {
        content: 'Test comment',
        postId: 1,
        parentId: undefined,
      };
      const expectedResult = { message: COMMENT_MESSAGES.CREATED, id: 1 };

      jest.spyOn(service, 'create').mockResolvedValue(expectedResult);

      const result = await request(app.getHttpServer())
        .post('/comments')
        .send(createDto)
        .expect(201);

      expect(service.create).toHaveBeenCalledWith(createDto, mockUser);
      expect(result.body).toEqual(expectedResult);
    });

    it('should throw BadRequestException when validation fails', async () => {
      const invalidDto = { content: '', postId: 0 } as CreateCommentDto;

      jest.spyOn(service, 'create').mockImplementation(() => {
        throw new BadRequestException(COMMENT_ERRORS.MAX_DEPTH_EXCEEDED);
      });

      await request(app.getHttpServer())
        .post('/comments')
        .send(invalidDto)
        .expect(400);
    });

    it('should throw NotFoundException if post cannot find', async () => {
      const noPostDto: CreateCommentDto = {
        content: 'Test comment',
        postId: 999,
        parentId: undefined,
      };

      jest.spyOn(service, 'create').mockImplementation(() => {
        throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
      });

      await request(app.getHttpServer())
        .post('/comments')
        .send(noPostDto)
        .expect(404);
    });
  });

  describe('update', () => {
    it('should update a comment successfully', async () => {
      const id = 1;
      const updateDto: UpdateCommentDto = { content: 'Updated comment' };
      const expectedResult = { message: COMMENT_MESSAGES.UPDATED, id: 1 };

      jest.spyOn(service, 'update').mockResolvedValue(expectedResult);

      const result = await request(app.getHttpServer())
        .put(`/comments/${id}`)
        .send(updateDto)
        .expect(200);

      expect(service.update).toHaveBeenCalledWith(1, updateDto, mockUser);
      expect(result.body).toMatchObject(expectedResult);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      const id = 999;
      const updateDto: UpdateCommentDto = { content: 'Updated comment' };

      jest.spyOn(service, 'update').mockImplementation(() => {
        throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
      });

      await request(app.getHttpServer())
        .put(`/comments/${id}`)
        .send(updateDto)
        .expect(404);
      expect(service.update).toHaveBeenCalledWith(999, updateDto, mockUser);
    });
  });

  describe('remove', () => {
    it('should remove a comment successfully', async () => {
      const id = 1;

      jest
        .spyOn(service, 'remove')
        .mockResolvedValue({ message: COMMENT_MESSAGES.DELETED, id: 1 });

      await request(app.getHttpServer()).delete(`/comments/${id}`).expect(200);

      expect(service.remove).toHaveBeenCalledWith(1, mockUser);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      const id = 999;

      jest.spyOn(service, 'remove').mockImplementation(() => {
        throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
      });

      await request(app.getHttpServer()).delete(`/comments/${id}`).expect(404);
      expect(service.remove).toHaveBeenCalledWith(999, mockUser);
    });

    it('should throw ForbiddenException when user does not have permission', async () => {
      const id = 1;

      jest.spyOn(service, 'remove').mockImplementation(() => {
        throw new ForbiddenException(COMMENT_ERRORS.NO_PERMISSION);
      });

      await request(app.getHttpServer()).delete(`/comments/${id}`).expect(403);
      expect(service.remove).toHaveBeenCalledWith(1, mockUser);
    });

    it('should throw InternalServerError when deleting user has failed.', async () => {
      const id = 1;

      jest.spyOn(service, 'remove').mockImplementation(() => {
        throw new InternalServerErrorException(
          '댓글 삭제 중 문제가 발생했습니다.',
        );
      });

      await request(app.getHttpServer()).delete(`/comments/${id}`).expect(500);
      expect(service.remove).toHaveBeenCalledWith(1, mockUser);
    });
  });

  describe('getComments', () => {
    it('should get paginated comments for a post', async () => {
      const postId = 1;
      const page = 1;
      const mockComments = [
        {
          id: 1,
          content: 'Comment 1',
          likes: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          nickname: 'user1',
          parentId: null,
          hasReplies: true,
        },
        {
          id: 2,
          content: 'Comment 2',
          likes: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          nickname: 'user2',
          parentId: null,
          hasReplies: false,
        },
      ];

      const expectedResult: PaginatedResponseDto<CommentListItemDto> = {
        data: mockComments,
        currentPage: 1,
        totalItems: 2,
        totalPages: 1,
      };

      jest
        .spyOn(service, 'getPagedCommentsFlat')
        .mockResolvedValue(expectedResult);

      const result = await request(app.getHttpServer())
        .get(`/comments/post/${postId}`)
        .query({ page })
        .expect(200);

      expect(service.getPagedCommentsFlat).toHaveBeenCalledWith(postId, page);

      const expectedResultWithFlexibleDates = {
        ...expectedResult,
        data: expectedResult.data.map((comment) => ({
          ...comment,

          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })),
      };
      expect(result.body).toMatchObject(expectedResultWithFlexibleDates);
    });

    it('should handle default page value when no page parameter is provided', async () => {
      const postId = 1;
      const mockComments = [
        {
          id: 1,
          content: 'Comment 1',
          likes: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          nickname: 'user1',
          parentId: null,
          hasReplies: true,
        },
      ];

      const expectedResult: PaginatedResponseDto<CommentListItemDto> = {
        data: mockComments,
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
      };

      jest
        .spyOn(service, 'getPagedCommentsFlat')
        .mockResolvedValue(expectedResult);

      const result = await request(app.getHttpServer())
        .get(`/comments/post/${postId}`)
        .expect(200);

      expect(service.getPagedCommentsFlat).toHaveBeenCalledWith(postId, 1);
      const expectedResultWithFlexibleDates = {
        ...expectedResult,
        data: expectedResult.data.map((comment) => ({
          ...comment,

          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })),
      };
      expect(result.body).toMatchObject(expectedResultWithFlexibleDates);
    });

    it('should convert string page parameter to number', async () => {
      const postId = 1;
      const page = 2;
      const mockComments = [
        {
          id: 3,
          content: 'Comment 3',
          likes: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          nickname: 'user3',
          parentId: null,
          hasReplies: false,
        },
        {
          id: 4,
          content: 'Comment 4',
          likes: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          nickname: 'user4',
          parentId: null,
          hasReplies: true,
        },
      ];

      const expectedResult: PaginatedResponseDto<CommentListItemDto> = {
        data: mockComments,
        currentPage: 2,
        totalItems: 4,
        totalPages: 2,
      };

      jest
        .spyOn(service, 'getPagedCommentsFlat')
        .mockResolvedValue(expectedResult);

      const result = await request(app.getHttpServer())
        .get(`/comments/post/${postId}`)
        .query({ page })
        .expect(200);

      expect(service.getPagedCommentsFlat).toHaveBeenCalledWith(postId, page);
      const expectedResultWithFlexibleDates = {
        ...expectedResult,
        data: expectedResult.data.map((comment) => ({
          ...comment,

          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })),
      };
      expect(result.body).toMatchObject(expectedResultWithFlexibleDates);
    });
  });

  describe('likeComment', () => {
    it('should toggle like on a comment successfully', async () => {
      const id = 1;
      const expectedResult = {
        likes: 1,
      };

      jest.spyOn(service, 'likeComment').mockResolvedValue(expectedResult);

      const result = await request(app.getHttpServer())
        .post(`/comments/like/${id}`)
        .expect(200);

      expect(service.likeComment).toHaveBeenCalledWith(1, mockUser);
      expect(result.body).toEqual(expectedResult);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      const id = 999;

      jest.spyOn(service, 'likeComment').mockImplementation(() => {
        throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
      });

      await request(app.getHttpServer())
        .post(`/comments/like/${id}`)
        .expect(404);
      expect(service.likeComment).toHaveBeenCalledWith(999, mockUser);
    });
  });
});
