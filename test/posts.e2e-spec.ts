import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { DataSource, Repository } from 'typeorm';
import { createUserDto } from '@/users/factory/user.factory';
import { User } from '@/users/entities/user.entity';
import { CreatePostDto } from '@/posts/dto/create-post.dto';
import { UpdatePostDto } from '@/posts/dto/update-post.dto';
import { BoardsService } from '@/boards/boards.service';
import { Board } from '@/boards/entities/board.entity';
import { createPost } from '@/posts/factories/post.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
  truncatePostsTable,
} from './utils/test.util';
import { Comment } from '@/comments/entities/comment.entity';
import { PostLike } from '@/posts/entities/post-like.entity';
import { POST_ERROR_MESSAGES } from '@/posts/constants/error-messages.constants';
import * as dotenv from 'dotenv';

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
dotenv.config({ path: envFile });

const SYSTEM_USER = {
  email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
  password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
};

const userInfos = Array(2)
  .fill('')
  .map(() => createUserDto());

describe('Posts - /posts (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let postRepository: Repository<Post>;
  let postLikeRepository: Repository<PostLike>;
  let userRepository: Repository<User>;
  let commentRepository: Repository<Comment>;
  let accessTokens: string[];
  let admin: User;
  let users: User[];
  let boardsService: BoardsService;
  let userBoard: Board;
  let adminBoard: Board;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    postLikeRepository = module.get<Repository<PostLike>>(
      getRepositoryToken(PostLike),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    commentRepository = module.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );
    boardsService = module.get<BoardsService>(BoardsService);

    const boards = await boardsService.findAll();
    userBoard = boards.find((board) => board.requiredRole === UserRole.USER);
    adminBoard = boards.find((board) => board.requiredRole === UserRole.ADMIN);
  }, 15000);

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

  beforeAll(async () => {
    admin = await userRepository.findOne({
      where: { email: SYSTEM_USER.email },
    });
    if (!admin) {
      throw new Error(`Admin not found: ${SYSTEM_USER.email}`);
    }
  });

  beforeEach(async () => {
    await truncatePostsTable(dataSource);
  });

  afterAll(async () => {
    await truncatePostsTable(dataSource);
    await truncateAllTables(dataSource);
    await app.close();
  });

  describe('POST /posts', () => {
    let accessToken: string;

    beforeAll(() => {
      if (!accessTokens || accessTokens.length === 0) {
        throw new Error('Access tokens are not initialized');
      }
      accessToken = accessTokens[0];
    });

    it('should create a post (성공)', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'This is a test post',
        boardSlug: userBoard.categorySlug.slug,
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        title: createPostDto.title,
        board: {
          id: expect.any(Number),
          slug: userBoard.categorySlug.slug,
          name: expect.any(String),
        },
        hotScore: expect.any(Number),
      });

      const postId = response.body.id;
      const post = await postRepository.findOne({
        where: { id: postId },
        relations: ['createdBy'],
      });
      expect(post.nickname).toBeTruthy();
    });

    it('should return 401 if not authenticated (실패)', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'This is a test post',
        boardSlug: userBoard.categorySlug.slug,
      };

      await request(app.getHttpServer())
        .post('/posts')
        .send(createPostDto)
        .expect(401);
    });

    it('should return 400 if required fields are missing (실패)', async () => {
      const defectiveCreatePostDto = {
        content: 'This is a test post',
      };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(defectiveCreatePostDto)
        .expect(400);
    });

    it('should return 401 if user lacks board role', async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Unauthorized Post',
          content: 'Test',
          boardSlug: adminBoard.categorySlug.slug,
        })
        .expect(401);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_CREATE_BOARD_PERMISSION_DENIED,
      );
    });
  });

  describe('GET /posts', () => {
    let user: User;

    beforeAll(() => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      user = users[0];
    });

    it('should return all posts (성공)', async () => {
      await postRepository.save(
        [
          {
            title: 'Post 1',
            content: 'Content 1',
            createdBy: user,
            board: userBoard,
          },
          {
            title: 'Post 2',
            content: 'Content 2',
            createdBy: user,
            board: userBoard,
          },
        ].map((post) => createPost(post)),
      );

      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body[0].board).toBeDefined();
    });

    it('should return an empty array if no posts exist (성공)', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /posts/user/:userId', () => {
    let user: User;

    beforeAll(() => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      user = users[0];
    });

    it('should return posts by a specific user (성공)', async () => {
      await postRepository.save(
        [
          {
            title: 'Post 1',
            content: 'Content 1',
            createdBy: user,
            board: userBoard,
          },
          {
            title: 'Post 2',
            content: 'Content 2',
            createdBy: user,
            board: userBoard,
          },
        ].map((post) => createPost(post)),
      );

      const response = await request(app.getHttpServer())
        .get(`/posts/user/${user.id}`)
        .expect(200);

      expect(response.body.length).toBe(2);
    });

    it('should return empty posts if user does not exist (성공)', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts/user/999')
        .expect(200);

      expect(response.body.length).toBe(0);
    });
  });

  describe('GET /posts/:id', () => {
    let user: User;

    beforeAll(() => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      user = users[0];
    });

    it('should return a specific post (성공)', async () => {
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: user,
          board: userBoard,
          likesCount: 1,
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/posts/${post.id}`)
        .expect(200);

      expect(response.body.id).toBe(post.id);
      expect(response.body.title).toBe(post.title);
      expect(response.body.views).toBe(post.views + 1);

      expect(response.body.hotScore).toBeDefined();
      expect(response.body.board).toMatchObject({
        id: userBoard.id,
        slug: userBoard.categorySlug.slug,
      });
      expect(response.body.likesCount).toBe(1);
    });

    it('should return 404 if post does not exist (실패)', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts/9')
        .expect(404);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_FIND_NOT_FOUND,
      );
    });
  });

  describe('PATCH /posts/:id', () => {
    beforeAll(async () => {
      if (!accessTokens || accessTokens.length === 0) {
        throw new Error('Access tokens are not initialized');
      }
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
    });

    it('should update a post by the owner (성공)', async () => {
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[0],
          board: userBoard,
        }),
      );

      const updatePostDto: UpdatePostDto = {
        title: 'Updated Post',
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(updatePostDto)
        .expect(200);

      expect(response.body.title).toBe(updatePostDto.title);
    });

    it('should return 401 if not authenticated (실패)', async () => {
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[0],
          board: userBoard,
        }),
      );

      const updatePostDto: UpdatePostDto = {
        title: 'Updated Post',
      };

      await request(app.getHttpServer())
        .patch(`/posts/${post.id}`)
        .send(updatePostDto)
        .expect(401);
    });

    it('해당 게시판의 수정 권한을 가지지 못한 유저는 401 에러와 함께 해당 메세지를 받습니다. (실패)', async () => {
      const post = await postRepository.save(
        createPost({
          title: '공지사항',
          content: 'ADMIN 테스트용',
          createdBy: users[0],
          board: adminBoard,
        }),
      );

      const updatePostDto: UpdatePostDto = {
        title: 'Updated Post',
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(updatePostDto)
        .expect(401);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_UPDATE_BOARD_PERMISSION_DENIED,
      );
    });

    it('should return 401 if user is not the owner or admin (실패)', async () => {
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[0],
          board: userBoard,
        }),
      );

      const updatePostDto: UpdatePostDto = {
        title: 'Updated Post',
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .send(updatePostDto)
        .expect(401);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_UPDATE_OWNERSHIP_PERMISSION_DENIED,
      );
    });

    it('should return 404 if post does not exist (실패)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/posts/999')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({ title: 'Updated Post' })
        .expect(404);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_FIND_NOT_FOUND,
      );
    });
  });

  describe('DELETE /posts/:id', () => {
    let post: Post;
    beforeAll(async () => {
      if (!accessTokens || accessTokens.length === 0) {
        throw new Error('Access tokens are not initialized');
      }
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
    });

    beforeEach(async () => {
      post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[0],
          board: userBoard,
        }),
      );

      expect(post).toBeDefined();
      expect(post.id).toBeGreaterThan(0);
      expect(post.title).toBe('Test Post');
    });

    afterEach(async () => {
      const deletePost = await postRepository.findOne({
        where: { id: post.id },
        withDeleted: true,
      });

      if (deletePost) {
        await postRepository
          .createQueryBuilder()
          .delete()
          .from(Post)
          .where('id = :id', { id: deletePost.id })
          .execute();
      }
    });

    it('should delete a post by the owner (성공)', async () => {
      const deleteResult = await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(deleteResult.body).toEqual({
        message: 'Post deleted successfully.',
      });

      const deletedPost = await postRepository.findOneBy({ id: post.id });
      expect(deletedPost).toBeNull();

      const softDeletedPosts = await postRepository.findOne({
        where: {
          id: post.id,
        },
        withDeleted: true,
      });

      expect(softDeletedPosts).not.toBeNull();
    });

    it('should return 401 if not authenticated (실패)', async () => {
      await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .expect(401);
    });

    it('해당 게시판의 삭제 권한을 가지지 못한 유저는 401 에러와 함께 해당 메세지를 받습니다. (실패)', async () => {
      const post = await postRepository.save(
        createPost({
          title: '공지사항',
          content: 'ADMIN 테스트용',
          createdBy: admin,
          board: adminBoard,
        }),
      );

      const response = await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(401);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_DELETE_BOARD_PERMISSION_DENIED,
      );
    });

    it('should return 401 if user is not the owner or admin (실패)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(401);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_DELETE_OWNERSHIP_PERMISSION_DENIED,
      );
    });

    it('should return 404 if post does not exist (실패)', async () => {
      await request(app.getHttpServer())
        .delete('/posts/999')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(404);
    });

    it('댓글이 달려있는 post 삭제 시 댓글 도 softdelete 처리 되어야 함', async () => {
      const comment = await commentRepository.save({
        content: 'Test comment',
        post: post,
        createdBy: users[0],
      });

      const existingComment = await commentRepository.findOne({
        where: { id: comment.id },
      });
      expect(existingComment).not.toBeNull();
      expect(existingComment.deletedAt).toBeNull();
      expect(existingComment.content).toBe('Test comment');

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(deleteResponse.body).toEqual({
        message: 'Post deleted successfully.',
      });

      const softDeletedPost = await postRepository.findOne({
        where: { id: post.id },
        withDeleted: true,
      });
      expect(softDeletedPost).not.toBeNull();
      expect(softDeletedPost.deletedAt).not.toBeNull();

      const softDeletedComment = await commentRepository.findOne({
        where: { id: comment.id },
        withDeleted: true,
      });
      expect(softDeletedComment).not.toBeNull();
      expect(softDeletedComment.deletedAt).not.toBeNull();
      expect(softDeletedComment.content).toBe('Test comment');

      const normalComment = await commentRepository.findOne({
        where: { id: comment.id },
      });
      expect(normalComment).toBeNull();
    });
  });

  describe('GET /posts/recent', () => {
    let user: User;

    beforeAll(() => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      user = users[0];
    });

    it('should return recent posts from specified boards', async () => {
      await postRepository.save(
        [
          {
            title: 'Post 1',
            content: 'Content 1',
            board: userBoard,
            createdBy: user,
          },
          {
            title: 'Post 2',
            content: 'Content 2',
            board: userBoard,
            createdBy: user,
          },
        ].map((post) => createPost(post)),
      );

      const response = await request(app.getHttpServer())
        .get('/posts/recent')
        .query({ boardIds: [userBoard.id], limit: 2 })
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /posts/board/:boardId', () => {
    let user: User;
    const totalPosts = 15;
    const defaultLimit = 10;

    beforeAll(() => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      user = users[0];
    });

    beforeEach(async () => {
      const postsToCreate = Array.from({ length: totalPosts }, (_, i) =>
        createPost({
          title: `Test Post ${i + 1}`,
          content: `Content for post ${i + 1}`,
          board: userBoard,
          createdBy: user,
          createdAt: new Date(Date.now() - i * 1000 * 60 * 60),
          views: i + 1,
        }),
      );
      await postRepository.save(postsToCreate);
    });

    it('should return paginated posts from a specific board (default page 1)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .expect(200);

      expect(response.body).toEqual({
        data: expect.any(Array),
        currentPage: 1,
        totalItems: totalPosts,
        totalPages: Math.ceil(totalPosts / defaultLimit),
      });

      expect(response.body.data).toHaveLength(defaultLimit);

      expect(response.body.data[0].title).toBe('Test Post 1');
      expect(response.body.data[0].board.id).toBe(userBoard.id);
      expect(response.body.data[0].nickname).toBe(user.nickname);
    });

    it('should return paginated posts with custom page and limit', async () => {
      const page = 2;
      const limit = 5;

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ page, limit })
        .expect(200);

      expect(response.body).toEqual({
        data: expect.any(Array),
        currentPage: page,
        totalItems: totalPosts,
        totalPages: Math.ceil(totalPosts / limit),
      });

      expect(response.body.data).toHaveLength(limit);

      expect(response.body.data[0].title).toBe('Test Post 6');
    });

    it('should return correct pagination info for last page', async () => {
      const page = Math.ceil(totalPosts / defaultLimit);
      const expectedItemsOnLastPage = totalPosts % defaultLimit || defaultLimit;

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ page })
        .expect(200);

      expect(response.body).toEqual({
        data: expect.any(Array),
        currentPage: page,
        totalItems: totalPosts,
        totalPages: page,
      });

      expect(response.body.data).toHaveLength(expectedItemsOnLastPage);
    });

    it('should return empty data array if page is out of range', async () => {
      const page = Math.ceil(totalPosts / defaultLimit) + 1;

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ page })
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        currentPage: page,
        totalItems: totalPosts,
        totalPages: Math.ceil(totalPosts / defaultLimit),
      });
    });

    it('should sort posts by createdAt DESC by default', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .expect(200);

      const dates = response.body.data.map((post: any) =>
        new Date(post.createdAt).getTime(),
      );
      const sortedDates = [...dates].sort((a, b) => b - a);
      expect(dates).toEqual(sortedDates);
    });

    it('should sort posts by createdAt ASC when specified', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ sort: 'createdAt', order: 'ASC' })
        .expect(200);

      const dates = response.body.data.map((post: any) => post.createdAt);
      const sortedDates = [...dates].sort((a, b) => a - b);
      expect(dates).toEqual(sortedDates);
    });

    it('should return empty paginated result if board has no posts', async () => {
      await postRepository.delete({ board: { id: userBoard.id } });

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      });
    });
  });

  describe('POST like/:id', () => {
    let user: User;
    let accessToken: string;
    let post: Post;

    beforeEach(async () => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      if (!accessTokens || accessTokens.length === 0) {
        throw new Error('Access tokens are not initialized');
      }

      user = users[0];
      accessToken = accessTokens[0];

      post = await postRepository.save(
        createPost({
          title: 'Like Test Post',
          content: 'This is a post for like testing',
          createdBy: user,
          board: userBoard,
        }),
      );
      expect(post).toBeDefined();
      expect(post.title).toBe('Like Test Post');
    });

    afterEach(async () => {
      const result = await postRepository.delete(post.id);
      expect(result.affected).toBe(1);
      await postLikeRepository.clear();
    });

    it('존재하지 않은 게시물에는 좋아요를 누를 수 없습니다.', async () => {
      const nonExistentPostId = 9999;

      const response = await request(app.getHttpServer())
        .post(`/posts/like/${nonExistentPostId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.message).toBe(
        POST_ERROR_MESSAGES.POST_FIND_NOT_FOUND,
      );
    });

    it('추천하지 않은 게시물에는 좋아요를 한 번 누를 수 있습니다.', async () => {
      const response = await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        postId: post.id,
        likesCount: 1,
        isAdded: true,
      });

      const likesCount = await postRepository.findOne({
        where: { id: post.id },
      });
      expect(likesCount.likesCount).toBe(1);

      const likeRecord = await postLikeRepository.findOne({
        where: { userId: user.id, postId: post.id },
      });
      expect(likeRecord).toBeDefined();
    });

    it('추천한 게시물에는 좋아요를 눌러도 그 행동을 무시합니다.', async () => {
      await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        postId: post.id,
        likesCount: 1,
        isAdded: false,
      });

      const likesCount = await postRepository.findOne({
        where: { id: post.id },
      });
      expect(likesCount.likesCount).toBe(1);

      const likeRecords = await postLikeRepository.find({
        where: { postId: post.id },
      });
      expect(likeRecords).toHaveLength(1);
    });

    it('인증되지 않은 사용자는 좋아요를 누를 수 없습니다.', async () => {
      await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .expect(401);
    });

    it('다른 사용자가 같은 게시물에 좋아요를 누를 수 있습니다.', async () => {
      await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(200);

      expect(response.body).toEqual({
        postId: post.id,
        likesCount: 2,
        isAdded: true,
      });

      const likesCount = await postRepository.findOne({
        where: { id: post.id },
      });
      expect(likesCount.likesCount).toBe(2);

      const likeRecords = await postLikeRepository.find({
        where: { postId: post.id },
      });
      expect(likeRecords).toHaveLength(2);
    });

    it('게시물 상세 조회 시 좋아요 수가 정확히 표시됩니다.', async () => {
      await request(app.getHttpServer())
        .post(`/posts/like/${post.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/posts/${post.id}`)
        .expect(200);

      expect(response.body.likesCount).toBe(1);
    });
  });
});
