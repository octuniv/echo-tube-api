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

const userInfos = Array(2)
  .fill('')
  .map(() => createUserDto());

describe('Posts - /posts (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let postRepository: Repository<Post>;
  let userRepository: Repository<User>;
  let accessTokens: string[];
  let users: User[];
  let boardsService: BoardsService;
  let userBoard: Board;
  let adminBoard: Board;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    boardsService = module.get<BoardsService>(BoardsService);

    const boards = await boardsService.findAll();
    userBoard = boards.find((board) => board.requiredRole === UserRole.USER);
    adminBoard = boards.find((board) => board.requiredRole === UserRole.ADMIN);
  }, 15000);

  beforeAll(async () => {
    // Sign up and login for all users
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

    // Find all users
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
        .set('Authorization', `Bearer ${accessToken}`) // 일반 사용자 토큰
        .send({
          title: 'Unauthorized Post',
          content: 'Test',
          boardSlug: adminBoard.categorySlug.slug,
        })
        .expect(401);

      expect(response.body.message).toBe(
        '해당 게시판에 글쓰기 권한이 없습니다',
      );
    });

    afterEach(async () => {
      await truncatePostsTable(dataSource);
    });
  });

  describe('GET /posts', () => {
    // const user = users[0];
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

    afterEach(async () => {
      await truncatePostsTable(dataSource);
    });
  });

  describe('GET /posts/user/:userId', () => {
    // const user = users[0];
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

    afterEach(async () => {
      await truncatePostsTable(dataSource);
    });
  });

  describe('GET /posts/:id', () => {
    // const user = users[0];
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
    });

    it('should return 404 if post does not exist (실패)', async () => {
      await request(app.getHttpServer()).get('/posts/9').expect(404);
    });

    afterEach(async () => {
      await truncatePostsTable(dataSource);
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

      await request(app.getHttpServer())
        .patch(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .send(updatePostDto)
        .expect(401);
    });

    it('should return 404 if post does not exist (실패)', async () => {
      await request(app.getHttpServer())
        .patch('/posts/999')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send({ title: 'Updated Post' })
        .expect(404);
    });

    afterEach(async () => {
      await truncatePostsTable(dataSource);
    });
  });

  describe('DELETE /posts/:id', () => {
    beforeAll(async () => {
      if (!accessTokens || accessTokens.length === 0) {
        throw new Error('Access tokens are not initialized');
      }
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
    });

    it('should delete a post by the owner (성공)', async () => {
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[0],
          board: userBoard,
        }),
      );

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
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[1],
          board: userBoard,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .expect(401);
    });

    it('should return 401 if user is not the owner or admin (실패)', async () => {
      const post = await postRepository.save(
        createPost({
          title: 'Test Post',
          content: 'This is a test post',
          createdBy: users[1],
          board: userBoard,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(401);
    });

    it('should return 404 if post does not exist (실패)', async () => {
      await request(app.getHttpServer())
        .delete('/posts/999')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(404);
    });

    afterEach(async () => {
      await truncatePostsTable(dataSource);
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
    const totalPosts = 15; // 테스트용 게시글 수
    const defaultLimit = 10; // 컨트롤러/서비스 기본값

    beforeAll(() => {
      if (!users || users.length === 0) {
        throw new Error('Users are not initialized');
      }
      user = users[0];
    });

    beforeEach(async () => {
      // 테스트 전에 해당 보드에 여러 게시글 생성
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

      // 기본 limit (10) 확인
      expect(response.body.data).toHaveLength(defaultLimit);
      // 게시글 내용 확인
      expect(response.body.data[0].title).toBe('Test Post 1'); // 최신순 (기본 정렬)
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
      // 두 번째 페이지의 첫 번째 게시글은 6번째 게시글이어야 함 (1-based index)
      expect(response.body.data[0].title).toBe('Test Post 6');
    });

    it('should return correct pagination info for last page', async () => {
      const page = Math.ceil(totalPosts / defaultLimit); // 마지막 페이지
      const expectedItemsOnLastPage = totalPosts % defaultLimit || defaultLimit; // 마지막 페이지 아이템 수

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ page })
        .expect(200);

      expect(response.body).toEqual({
        data: expect.any(Array),
        currentPage: page,
        totalItems: totalPosts,
        totalPages: page, // totalPages는 마지막 페이지 번호와 같음
      });

      expect(response.body.data).toHaveLength(expectedItemsOnLastPage);
    });

    it('should return empty data array if page is out of range', async () => {
      const page = Math.ceil(totalPosts / defaultLimit) + 1; // 범위를 벗어난 페이지

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ page })
        .expect(200); // 404 대신 200 OK, 빈 데이터 배열 반환

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
      const sortedDates = [...dates].sort((a, b) => b - a); // 내림차순 정렬
      expect(dates).toEqual(sortedDates);
    });

    it('should sort posts by createdAt ASC when specified', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`)
        .query({ sort: 'createdAt', order: 'ASC' })
        .expect(200);

      const dates = response.body.data.map((post: any) => post.createdAt);
      const sortedDates = [...dates].sort((a, b) => a - b); // 오름차순 정렬
      expect(dates).toEqual(sortedDates);
    });

    it('should return empty paginated result if board has no posts', async () => {
      // 다른 보드 (게시글 없는)를 사용하거나, 기존 게시글을 모두 삭제한 후 테스트
      await truncatePostsTable(dataSource); // 현재 테스트 전에 게시글 삭제

      const response = await request(app.getHttpServer())
        .get(`/posts/board/${userBoard.id}`) // 게시글이 없는 보드
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      });
    });

    afterEach(async () => {
      await truncatePostsTable(dataSource);
    });
  });
});
