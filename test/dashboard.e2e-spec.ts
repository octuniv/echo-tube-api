import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { DashboardModule } from '@/dashboard/dashboard.module';
import { DbModule } from '@/db/db.module';
import { UsersModule } from '@/users/users.module';
import { PostsModule } from '@/posts/posts.module';
import { AuthModule } from '@/auth/auth.module';
import { TestDbModule } from './test-db.e2e.module';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { MakeCreateUserDtoFaker } from '@/users/faker/user.faker';
import { createPost } from '@/posts/factories/post.factory';
import { Visitor } from '@/visitor/entities/visitor.entity';
import { User } from '@/users/entities/user.entity';
import { createVisitor } from '@/visitor/factories/visitor.factory';
import { VisitorModule } from '@/visitor/visitor.module';
import { BoardsModule } from '@/boards/boards.module';
import { CategoriesModule } from '@/categories/categories.module';
import { BoardsService } from '@/boards/boards.service';

const userInfo = MakeCreateUserDtoFaker();

const truncateAllTable = async (dataSource: DataSource) => {
  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(
      `TRUNCATE ${entity.tableName} RESTART IDENTITY CASCADE;`,
    );
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
  let boardsService: BoardsService;
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
        VisitorModule,
        BoardsModule,
        CategoriesModule,
      ],
    })
      .overrideModule(DbModule)
      .useModule(TestDbModule)
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
    boardsService = moduleFixture.get<BoardsService>(BoardsService);
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
    const boards = await boardsService.findAll();
    const testBoard = boards[0];

    const posts = [
      createPost({
        title: 'Hot Post 1',
        content: 'Content 1',
        hotScore: 95,
        board: testBoard,
        createdBy: user,
      }),
      createPost({
        title: 'Hot Post 2',
        content: 'Content 2',
        hotScore: 85,
        board: testBoard,
        createdBy: user,
      }),
    ];
    posts.forEach(async (post) => {
      await postRepository.save({
        ...post,
        createdBy: user,
        nickname: user.nickname,
      });
    });

    const today = new Date().toISOString().split('T')[0];
    const visitor = createVisitor();
    visitor.date = today;
    await visitorRepository.save(visitor);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    expect(response.body).toEqual({
      visitors: visitor.count,
      popularPosts: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          title: 'Hot Post 1',
          boardName: testBoard.name,
          hotScore: 95,
        }),
        expect.objectContaining({
          id: expect.any(Number),
          title: 'Hot Post 2',
          boardName: testBoard.name,
          hotScore: 85,
        }),
      ]),
    });
  });
});
