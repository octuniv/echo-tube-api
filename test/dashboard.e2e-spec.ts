import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { VisitorService } from '@/visitor/visitor.service';
import { DashboardModule } from '@/dashboard/dashboard.module';
import { DbModule } from '@/db/db.module';
import { UsersModule } from '@/users/users.module';
import { PostsModule } from '@/posts/posts.module';
import { AuthModule } from '@/auth/auth.module';
import { TestE2EDbModule } from './test-db.e2e.module';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { MakeCreateUserDtoFaker } from '@/users/faker/user.faker';
import { createFakePost } from '@/posts/faker/post.faker';
import { Visitor } from '@/visitor/entities/visitor.entity';
import { User } from '@/users/entities/user.entity';

const userInfo = MakeCreateUserDtoFaker();

const truncateAllTable = async (dataSource: DataSource) => {
  const queryRunner = dataSource.createQueryRunner(); // QueryRunner 생성
  await queryRunner.connect(); // 데이터베이스 연결
  await queryRunner.startTransaction(); // 트랜잭션 시작

  try {
    await queryRunner.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await queryRunner.query('TRUNCATE TABLE visitor RESTART IDENTITY CASCADE');
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

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let user: User;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let visitorRepository: Repository<Visitor>;
  let visitorService: VisitorService;
  let dataSource: DataSource;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        DashboardModule,
        DbModule,
        UsersModule,
        PostsModule,
        AuthModule,
      ],
    })
      .overrideModule(DbModule)
      .useModule(TestE2EDbModule)
      .compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    postRepository = moduleFixture.get<Repository<Post>>(
      getRepositoryToken(Post),
    );
    visitorRepository = moduleFixture.get<Repository<Visitor>>(
      getRepositoryToken(Visitor),
    );
    visitorService = moduleFixture.get<VisitorService>(VisitorService);
    dataSource = moduleFixture.get<DataSource>(DataSource);
    await app.init();
  });

  beforeAll(async () => {
    accessToken = await signUpAndLogin(app, userInfo);
    user = await userRepository.findOne({ where: { email: userInfo.email } });
    expect(accessToken).toBeDefined();
    expect(user).toBeDefined();
  });

  afterEach(async () => {
    await truncateAllTable(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/dashboard/summary (GET) should return dashboard summary', async () => {
    const posts = [createFakePost(), createFakePost()];
    posts.forEach(async (post) => {
      await postRepository.save({
        ...post,
        createdBy: user,
        nickname: user.nickname,
      });
    });

    const today = new Date().toISOString().split('T')[0];
    const visitor = new Visitor();
    visitor.date = today;
    visitor.count = 11;
    await visitorRepository.save(visitor);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      visitors: visitor.count,
      popularPosts: posts
        .map((post) => {
          return {
            id: expect.any(Number),
            title: post.title,
            views: post.views,
          };
        })
        .sort((a, b) => b.views - a.views),
    });
  });
});
