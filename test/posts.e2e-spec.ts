import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '@/app.module';
import { DbModule } from '@/db/db.module';
import { TestE2EDbModule } from './test-db.e2e.module';
import { MakeCreateUserDtoFaker } from '@/users/faker/user.faker';
import { User } from '@/users/entities/user.entity';
import { CreatePostDto } from '@/posts/dto/create-post.dto';
import { UpdatePostDto } from '@/posts/dto/update-post.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';

const userInfos = Array(2)
  .fill('')
  .map(() => MakeCreateUserDtoFaker());

const truncateUsersTable = async (dataSource: DataSource) => {
  const queryRunner = dataSource.createQueryRunner(); // QueryRunner 생성
  await queryRunner.connect(); // 데이터베이스 연결
  await queryRunner.startTransaction(); // 트랜잭션 시작

  try {
    await queryRunner.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE'); // users, post 테이블 TRUNCATE
    await queryRunner.commitTransaction(); // 트랜잭션 커밋
  } catch (err) {
    await queryRunner.rollbackTransaction(); // 오류 발생 시 롤백
    throw err;
  } finally {
    await queryRunner.release(); // QueryRunner 해제
  }
};

const truncatePostTable = async (dataSource: DataSource) => {
  const queryRunner = dataSource.createQueryRunner(); // QueryRunner 생성
  await queryRunner.connect(); // 데이터베이스 연결
  await queryRunner.startTransaction(); // 트랜잭션 시작

  try {
    await queryRunner.query('TRUNCATE TABLE post RESTART IDENTITY CASCADE'); // post 테이블 TRUNCATE
    await queryRunner.commitTransaction(); // 트랜잭션 커밋
  } catch (err) {
    await queryRunner.rollbackTransaction(); // 오류 발생 시 롤백
    throw err;
  } finally {
    await queryRunner.release(); // QueryRunner 해제
  }
};

const signUpAndLogin = async (
  app: INestApplication,
  userInfo: CreateUserDto,
) => {
  // sign up test user to use this test
  const signUpResponse = await request(app.getHttpServer())
    .post('/users')
    .send(userInfo)
    .expect(201);

  expect(signUpResponse.body).toMatchObject({
    email: userInfo.email,
    message: 'Successfully created account',
  });

  // log in test user
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: userInfo.email,
      password: userInfo.password,
    })
    .expect(200);

  expect(loginResponse.body).toHaveProperty('access_token');
  return loginResponse.body.access_token as string;
};

describe('Posts - /posts (e2e)', () => {
  let app: INestApplication;
  let postRepository: Repository<Post>;
  let userRepository: Repository<User>;
  let dataSource: DataSource;
  let accessTokens: string[];
  let users: User[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DbModule)
      .useModule(TestE2EDbModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    postRepository = moduleFixture.get<Repository<Post>>(
      getRepositoryToken(Post),
    );
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

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
    await truncatePostTable(dataSource);
  });

  afterAll(async () => {
    await truncateUsersTable(dataSource);
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
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).not.toHaveProperty('createdBy');
      expect(response.body.title).toBe(createPostDto.title);

      const postId = response.body.id;
      const post = await postRepository.findOne({
        where: { id: postId },
        relations: ['createdBy'],
      });
      expect(post.nickName).toBeTruthy();
    });

    it('should return 401 if not authenticated (실패)', async () => {
      const createPostDto: CreatePostDto = {
        title: 'Test Post',
        content: 'This is a test post',
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

    afterEach(async () => {
      await truncatePostTable(dataSource);
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
      await postRepository.save([
        { title: 'Post 1', content: 'Content 1', createdBy: user },
        { title: 'Post 2', content: 'Content 2', createdBy: user },
      ]);

      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(response.body.length).toBe(2);
    });

    it('should return an empty array if no posts exist (성공)', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    afterEach(async () => {
      await truncatePostTable(dataSource);
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
      await postRepository.save([
        { title: 'Post 1', content: 'Content 1', createdBy: user },
        { title: 'Post 2', content: 'Content 2', createdBy: user },
      ]);

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
      await truncatePostTable(dataSource);
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
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: user,
      });

      const response = await request(app.getHttpServer())
        .get(`/posts/${post.id}`)
        .expect(200);

      expect(response.body.id).toBe(post.id);
      expect(response.body.title).toBe(post.title);
    });

    it('should return 404 if post does not exist (실패)', async () => {
      await request(app.getHttpServer()).get('/posts/999').expect(404);
    });

    afterEach(async () => {
      await truncatePostTable(dataSource);
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
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: users[0],
      });

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
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: users[0],
      });

      const updatePostDto: UpdatePostDto = {
        title: 'Updated Post',
      };

      await request(app.getHttpServer())
        .patch(`/posts/${post.id}`)
        .send(updatePostDto)
        .expect(401);
    });

    it('should return 401 if user is not the owner or admin (실패)', async () => {
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: users[0],
      });

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
      await truncatePostTable(dataSource);
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
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: users[0],
      });

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
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: users[1],
      });

      await request(app.getHttpServer())
        .delete(`/posts/${post.id}`)
        .expect(401);
    });

    it('should return 401 if user is not the owner or admin (실패)', async () => {
      const post = await postRepository.save({
        title: 'Test Post',
        content: 'This is a test post',
        createdBy: users[1],
      });

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
      await truncatePostTable(dataSource);
    });
  });
});
