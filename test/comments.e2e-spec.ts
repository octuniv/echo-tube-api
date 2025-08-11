import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { createUserDto } from '@/users/factory/user.factory';
import { User } from '@/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as request from 'supertest';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { CreateCommentDto } from '@/comments/dto/create-comment.dto';
import { Post } from '@/posts/entities/post.entity';
import { Comment } from '@/comments/entities/comment.entity';
import { Board } from '@/boards/entities/board.entity';
import {
  COMMENT_ERRORS,
  COMMENT_MESSAGES,
} from '@/comments/constants/comment.constants';
import { UpdateCommentDto } from '@/comments/dto/update-comment.dto';
import { CommentLike } from '@/comments/entities/commentLike.entity';
import { CommentListItemDto } from '@/comments/dto/comment-list-item.dto';

const userInfos = Array(2)
  .fill('')
  .map(() => createUserDto());

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
dotenv.config({ path: envFile });

const SYSTEM_USER = {
  email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
  password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
};

describe('Comments - /comments (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  let userRepository: Repository<User>;
  let boardRepository: Repository<Board>;
  let postRepository: Repository<Post>;
  let commentRepository: Repository<Comment>;
  let commentLikeRepository: Repository<CommentLike>;

  let adminToken: string;
  let accessTokens: string[];
  let users: User[];

  let testPost: Post;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    boardRepository = module.get<Repository<Board>>(getRepositoryToken(Board));
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    commentRepository = module.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );
    commentLikeRepository = module.get<Repository<CommentLike>>(
      getRepositoryToken(CommentLike),
    );
  }, 15000);

  beforeAll(async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: SYSTEM_USER.email,
        password: SYSTEM_USER.password,
      } satisfies LoginUserDto)
      .expect(200);

    adminToken = loginResponse.body.access_token;
  });

  beforeAll(async () => {
    accessTokens = await Promise.all(
      userInfos.map(async (userInfo) => {
        const token = await signUpAndLogin(app, userInfo);
        if (!token) {
          throw new Error(
            `Failed to sign up or log in user: ${userInfo.email}`,
          );
        }
        return token;
      }),
    );

    users = await Promise.all(
      userInfos.map(async (userInfo) => {
        const user = await userRepository.findOne({
          where: { email: userInfo.email },
        });
        if (!user) {
          throw new Error(`User not found: ${userInfo.email}`);
        }
        return user;
      }),
    );

    expect(accessTokens).toHaveLength(2);
    expect(users).toHaveLength(2);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    const testBoard = await boardRepository.findOne({
      where: { categorySlug: { slug: 'free' } },
      relations: ['category', 'categorySlug'],
    });
    const newPost = postRepository.create({
      title: 'test',
      content: 'test',
      board: testBoard,
      createdBy: users[0],
    });
    testPost = await postRepository.save(newPost);
    expect(testPost).toBeDefined();
    expect(testPost).toMatchObject({
      id: expect.any(Number),
      title: 'test',
      board: {
        id: expect.any(Number),
        name: '자유 게시판',
      },
      hotScore: expect.any(Number),
    });
  });

  afterEach(async () => {
    const removeResult = await postRepository.delete(testPost.id);
    expect(removeResult.affected).toBe(1);
    const checkRemoved = await postRepository.findOne({
      where: { id: testPost.id },
    });
    expect(checkRemoved).toBeNull();
  });

  describe('댓글 생성 (POST /comments)', () => {
    it('인증되지 않은 사용자가 댓글 생성 시도 시 401 Unauthorized 응답 확인', async () => {
      await request(app.getHttpServer())
        .post('/comments')
        .send({
          content: 'test',
          postId: testPost.id,
        } satisfies CreateCommentDto)
        .expect(401);
    });

    it('존재하지 않는 게시물에 댓글 생성 시도 시 404 Not Found 응답 확인', async () => {
      await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test',
          postId: 9999999,
        } satisfies CreateCommentDto)
        .expect(404);
    });

    it('빈 내용의 댓글 생성 시도 시 400 Bad Request 응답 확인', async () => {
      await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          postId: testPost.id,
        })
        .expect(400);
    });

    it('존재하지 않은 댓글의 대댓글 생성 시도 시 404 Not Found 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test1',
          postId: testPost.id,
          parentId: 999999,
        } satisfies CreateCommentDto)
        .expect(404);

      expect(response.body).toMatchObject({
        message: COMMENT_ERRORS.PARENT_NOT_FOUND,
      });
    });

    it('댓글, 대댓글 성공 및 제약 조건 확인', async () => {
      let response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test1',
          postId: testPost.id,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      const firstCommentId = response.body.id;

      response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test2',
          postId: testPost.id,
          parentId: firstCommentId,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      const secondCommentId = response.body.id;

      response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test3',
          postId: testPost.id,
          parentId: secondCommentId,
        } satisfies CreateCommentDto)
        .expect(400);

      expect(response.body).toMatchObject({
        message: COMMENT_ERRORS.MAX_DEPTH_EXCEEDED,
      });

      const storedFirstComment = await commentRepository.findOne({
        where: { id: firstCommentId },
        relations: ['children'],
      });
      expect(storedFirstComment).toMatchObject({
        children: [{ id: secondCommentId }],
      });

      const storedSecondComment = await commentRepository.findOne({
        where: { id: secondCommentId },
        relations: ['parent'],
      });
      expect(storedSecondComment).toMatchObject({
        parent: { id: firstCommentId },
      });

      const post = await postRepository.findOne({
        where: { id: testPost.id },
        relations: ['comments'],
      });
      expect(post).toMatchObject({
        commentsCount: 2,
        comments: [{ id: firstCommentId }, { id: secondCommentId }],
      });
    });
  });

  describe('댓글 수정 (PUT /comments/:id)', () => {
    let commentId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test1',
          postId: testPost.id,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      commentId = response.body.id;
    });

    it('인증되지 않은 사용자가 댓글 수정 시도 시 401 Unauthorized 응답 확인', async () => {
      await request(app.getHttpServer())
        .put(`/comments/${commentId}`)
        .send({
          content: 'change',
        } satisfies UpdateCommentDto)
        .expect(401);
    });

    it('타인이 작성한 댓글 수정 시도 시 403 Forbidden 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .put(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .send({
          content: 'change',
        } satisfies UpdateCommentDto)
        .expect(403);

      expect(response.body).toMatchObject({
        message: COMMENT_ERRORS.NO_PERMISSION,
      });
    });

    it('존재하지 않는 댓글 수정 시도 시 404 Not Found 응답 확인', async () => {
      await request(app.getHttpServer())
        .put(`/comments/${9999999}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'change',
        } satisfies UpdateCommentDto)
        .expect(404);
    });

    it('빈 내용으로 수정 시도 시 400 Bad Request 응답 확인', async () => {
      await request(app.getHttpServer())
        .put(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(400);
    });

    it('본인이 작성한 댓글 수정 시 200 OK 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .put(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'change',
        } satisfies UpdateCommentDto)
        .expect(200);

      expect(response.body).toEqual({
        message: COMMENT_MESSAGES.UPDATED,
        id: commentId,
      });

      const changedCommend = await commentRepository.findOne({
        where: { id: commentId },
      });

      expect(changedCommend).toMatchObject({ content: 'change' });
    });
  });

  describe('댓글 삭제 (DELETE /comments/:id)', () => {
    let commentId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test1',
          postId: testPost.id,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      commentId = response.body.id;
    });

    it('인증되지 않은 사용자가 댓글 삭제 시도 시 401 Unauthorized 응답 확인', async () => {
      await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .expect(401);
    });

    it('타인이 작성한 댓글 삭제 시도 시 403 Forbidden 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(403);
      expect(response.body).toMatchObject({
        message: COMMENT_ERRORS.NO_PERMISSION,
      });
    });

    it('존재하지 않는 댓글 ID로 삭제 시도 시 404 Not Found 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/comments/${9999999}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(404);
      expect(response.body).toMatchObject({
        message: COMMENT_ERRORS.NOT_FOUND,
      });
    });

    it('본인이 작성한 댓글 삭제 시 200 OK 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(response.body).toEqual({
        message: COMMENT_MESSAGES.DELETED,
        id: commentId,
      });

      const post = await postRepository.findOne({
        where: { id: testPost.id },
        relations: ['comments'],
      });
      expect(post).toMatchObject({
        commentsCount: 0,
        comments: [],
      });

      const deletedComment = await commentRepository.findOne({
        where: { id: commentId },
        withDeleted: true,
      });
      expect(deletedComment).toMatchObject({
        id: commentId,
        deletedAt: expect.any(Date),
      });
    });

    it('관리자 권한으로 타인 댓글 삭제 시 200 OK 응답 확인', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: COMMENT_MESSAGES.DELETED,
        id: commentId,
      });

      const post = await postRepository.findOne({
        where: { id: testPost.id },
        relations: ['comments'],
      });
      expect(post).toMatchObject({
        commentsCount: 0,
        comments: [],
      });

      const deletedComment = await commentRepository.findOne({
        where: { id: commentId },
        withDeleted: true,
      });
      expect(deletedComment).toMatchObject({
        id: commentId,
        deletedAt: expect.any(Date),
      });
    });

    it('삭제 시 댓글-대댓글 관계 검증', async () => {
      let response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test2',
          postId: testPost.id,
          parentId: commentId,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      const childrenId = response.body.id;

      response = await request(app.getHttpServer())
        .delete(`/comments/${childrenId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(response.body).toEqual({
        message: COMMENT_MESSAGES.DELETED,
        id: childrenId,
      });

      const parent = await commentRepository.findOne({
        where: { id: commentId },
        relations: ['children'],
      });
      expect(parent.children).toEqual([]);

      response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test3',
          postId: testPost.id,
          parentId: commentId,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      const anotherChildId = response.body.id;

      response = await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(response.body).toEqual({
        message: COMMENT_MESSAGES.DELETED,
        id: commentId,
      });

      const anotherChild = await commentRepository.findOne({
        where: { id: anotherChildId },
        relations: { createdBy: true, parent: true, children: true },
      });
      expect(anotherChild).toMatchObject({ id: anotherChildId });

      const presentPost = await postRepository.findOne({
        where: { id: testPost.id },
      });
      expect(presentPost).toMatchObject({ commentsCount: 1 });
    });
  });

  describe('댓글 좋아요 (POST /comments/like/:id)', () => {
    let commentId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/comments')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({
          content: 'test1',
          postId: testPost.id,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: COMMENT_MESSAGES.CREATED,
        id: expect.any(Number),
      });

      commentId = response.body.id;
    });

    it('인증되지 않은 사용자가 좋아요 요청 시 401 Unauthorized 응답 확인', async () => {
      await request(app.getHttpServer())
        .post(`/comments/like/${commentId}`)
        .expect(401);
    });

    it('존재하지 않는 댓글 ID로 좋아요 요청 시 404 Not Found 응답 확인', async () => {
      await request(app.getHttpServer())
        .post(`/comments/like/${999999}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(404);
    });

    it('좋아요 추가/취소 검증', async () => {
      let response = await request(app.getHttpServer())
        .post(`/comments/like/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(response.body).toEqual({ likes: 1 });

      let presentComment = await commentRepository.findOne({
        where: { id: commentId },
      });
      expect(presentComment.likes).toEqual(1);

      let presentCommendLikes = await commentLikeRepository.find();
      expect(presentCommendLikes.length).toBe(1);

      response = await request(app.getHttpServer())
        .post(`/comments/like/${commentId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(response.body).toEqual({ likes: 0 });

      presentComment = await commentRepository.findOne({
        where: { id: commentId },
      });
      expect(presentComment.likes).toEqual(0);

      presentCommendLikes = await commentLikeRepository.find();
      expect(presentCommendLikes.length).toBe(0);
    });

    it('다중 사용자 검증', async () => {
      const multiUsersToken = [...accessTokens, adminToken];
      await Promise.all(
        multiUsersToken.map(async (token) => {
          await request(app.getHttpServer())
            .post(`/comments/like/${commentId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        }),
      );

      const presentComment = await commentRepository.findOne({
        where: { id: commentId },
      });
      expect(presentComment.likes).toEqual(multiUsersToken.length);

      const presentCommentLikes = await commentLikeRepository.find();
      expect(presentCommentLikes.length).toBe(multiUsersToken.length);
    });
  });

  describe('댓글 조회 (GET /comments/post/:postId)', () => {
    it('존재하지 않는 게시물 검증: 존재하지 않는 게시물 ID로 요청 시 빈 배열이 반환되는지 확인', async () => {
      const response = await request(app.getHttpServer())
        .get(`/comments/post/${9999999}`)
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('빈 게시물 검증: 댓글이 없는 게시물 요청 시 빈 배열이 반환되는지 확인', async () => {
      const response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}`)
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('소프트 삭제된 댓글 포함 페이징 검증: 삭제된 댓글이 페이징에 포함되고 올바르게 표시되는지 확인', async () => {
      const parentIds = [];
      for (let i = 0; i < 15; i++) {
        const response = await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[0]}`)
          .send({
            content: `부모 댓글 ${i + 1}`,
            postId: testPost.id,
          });
        parentIds.push(response.body.id);

        if (i % 2 === 0) {
          await request(app.getHttpServer())
            .post('/comments')
            .set('Authorization', `Bearer ${accessTokens[1]}`)
            .send({
              content: `대댓글 ${i + 1}-1`,
              postId: testPost.id,
              parentId: response.body.id,
            });
        }
      }

      for (let i = 0; i < parentIds.length; i += 2) {
        await request(app.getHttpServer())
          .delete(`/comments/${parentIds[i]}`)
          .set('Authorization', `Bearer ${accessTokens[0]}`)
          .expect(200);
      }

      const response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=1`)
        .expect(200);

      const deletedComments = response.body.data.filter(
        (comment: CommentListItemDto) =>
          comment.content === '[삭제된 댓글]' &&
          comment.nickname === '알 수 없음',
      );
      expect(deletedComments.length).toBe(5);

      const repliesToDeleted = response.body.data.filter(
        (comment: CommentListItemDto) =>
          comment.parentId && comment.content.includes('대댓글'),
      );
      expect(repliesToDeleted.length).toBe(5);
    });

    it('다중 페이지 테스트: 15개의 부모 댓글 생성 시 페이지 1과 2의 결과가 올바른지 확인', async () => {
      const parentIds = [];
      for (let i = 0; i < 15; i++) {
        const response = await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[0]}`)
          .send({
            content: `부모 댓글 ${i + 1}`,
            postId: testPost.id,
          });
        parentIds.push(response.body.id);

        const replyCount = i % 2 === 0 ? 1 : 2;
        for (let j = 0; j < replyCount; j++) {
          await request(app.getHttpServer())
            .post('/comments')
            .set('Authorization', `Bearer ${accessTokens[1]}`)
            .send({
              content: `대댓글 ${i + 1}-${j + 1}`,
              postId: testPost.id,
              parentId: response.body.id,
            });
        }
      }

      const page1Response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=1`)
        .expect(200);

      expect(page1Response.body.currentPage).toBe(1);
      expect(page1Response.body.totalItems).toBe(15);
      expect(page1Response.body.totalPages).toBe(2);
      expect(page1Response.body.data.length).toBe(25);

      const page2Response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=2`)
        .expect(200);

      expect(page2Response.body.currentPage).toBe(2);
      expect(page2Response.body.totalItems).toBe(15);
      expect(page2Response.body.totalPages).toBe(2);
      expect(page2Response.body.data.length).toBe(12);

      const page3Response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=3`)
        .expect(200);

      expect(page3Response.body.currentPage).toBe(3);
      expect(page3Response.body.data.length).toBe(0);
    });

    it('경계값 테스트: 페이지네이션 경계 조건 검증', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[0]}`)
          .send({
            content: `부모 댓글 ${i + 1}`,
            postId: testPost.id,
          });
      }

      const page1Response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=1`)
        .expect(200);
      expect(page1Response.body.data.length).toBe(10);
      expect(page1Response.body.totalPages).toBe(1);

      const page2Response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=2`)
        .expect(200);
      expect(page2Response.body.data.length).toBe(0);
      expect(page2Response.body.totalPages).toBe(1);

      const page0Response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=0`)
        .expect(200);
      expect(page0Response.body.currentPage).toBe(1);

      const negativePageResponse = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=-5`)
        .expect(200);
      expect(negativePageResponse.body.currentPage).toBe(1);
    });

    it('대댓글이 많은 경우 페이징 검증: 대댓글 수가 많아도 부모 댓글 기준 페이징이 동작하는지 확인', async () => {
      const parentIds = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[0]}`)
          .send({
            content: `부모 댓글 ${i + 1}`,
            postId: testPost.id,
          });
        parentIds.push(response.body.id);

        for (let j = 0; j < 5; j++) {
          await request(app.getHttpServer())
            .post('/comments')
            .set('Authorization', `Bearer ${accessTokens[1]}`)
            .send({
              content: `대댓글 ${i + 1}-${j + 1}`,
              postId: testPost.id,
              parentId: response.body.id,
            });
        }
      }

      const response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}?page=1`)
        .expect(200);

      expect(response.body.data.length).toBe(60);
      expect(response.body.totalItems).toBe(10);
      expect(response.body.totalPages).toBe(1);
    });

    it('정렬 순서 검증: 부모 댓글은 최신순, 대댓글은 작성순으로 정렬되는지 확인', async () => {
      const timestamps = [];
      const parentIds = [];

      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const response = await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[0]}`)
          .send({
            content: `부모 댓글 ${i + 1}`,
            postId: testPost.id,
          });
        parentIds.push(response.body.id);
        timestamps.push(new Date().toISOString());
      }

      for (let i = parentIds.length - 1; i >= 0; i--) {
        await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[1]}`)
          .send({
            content: `대댓글 ${i + 1}-1`,
            postId: testPost.id,
            parentId: parentIds[i],
          });

        await new Promise((resolve) => setTimeout(resolve, 50));

        await request(app.getHttpServer())
          .post('/comments')
          .set('Authorization', `Bearer ${accessTokens[1]}`)
          .send({
            content: `대댓글 ${i + 1}-2`,
            postId: testPost.id,
            parentId: parentIds[i],
          });
      }

      const response = await request(app.getHttpServer())
        .get(`/comments/post/${testPost.id}`)
        .expect(200);

      for (let i = 0; i < 3; i++) {
        expect(response.body.data[i * 3].content).toBe(`부모 댓글 ${3 - i}`);
      }

      for (let i = 0; i < 3; i++) {
        const parentIndex = i * 3;
        expect(response.body.data[parentIndex + 1].content).toBe(
          `대댓글 ${3 - i}-1`,
        );
        expect(response.body.data[parentIndex + 2].content).toBe(
          `대댓글 ${3 - i}-2`,
        );
      }
    });
  });
});
