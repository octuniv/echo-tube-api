import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { createUserDto } from '@/users/factory/user.factory';
import { createPost } from '@/posts/factories/post.factory';
import { Visitor } from '@/visitor/entities/visitor.entity';
import { User } from '@/users/entities/user.entity';
import {
  createVisitor,
  createVisitorEntry,
} from '@/visitor/factories/visitor.factory';
import { BoardsService } from '@/boards/boards.service';
import { VisitorEntry } from '@/visitor/entities/visitor-entry.entity';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
  truncatePostsTable,
} from './utils/test.util';
import { plainToInstance } from 'class-transformer';
import { DashboardSummaryDto } from '@/dashboard/dto/dashboard.summary.dto';
import { validate } from 'class-validator';

const userInfo = createUserDto();

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let user: User;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let visitorRepository: Repository<Visitor>;
  let visitorEntryRepository: Repository<VisitorEntry>;
  let boardsService: BoardsService;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
    visitorRepository = module.get<Repository<Visitor>>(
      getRepositoryToken(Visitor),
    );
    visitorEntryRepository = module.get<Repository<VisitorEntry>>(
      getRepositoryToken(VisitorEntry),
    );
    boardsService = module.get<BoardsService>(BoardsService);
  }, 15000);

  beforeAll(async () => {
    await signUpAndLogin(app, userInfo);
    user = await userRepository.findOne({ where: { email: userInfo.email } });
    expect(user).toBeDefined();
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await truncatePostsTable(dataSource);
  });

  it('/dashboard/summary (GET) should return dashboard summary', async () => {
    const boards = await boardsService.findAll();
    const testBoard = boards.find(
      (board) => board.categorySlug.slug === 'free',
    );

    const recentPosts = [
      createPost({
        title: 'Recent Post 1',
        content: 'Content 1',
        hotScore: 1,
        createdAt: new Date('2023-10-01'),
        board: testBoard,
        createdBy: user,
      }),
      createPost({
        title: 'Recent Post 2',
        content: 'Content 2',
        hotScore: 2,
        createdAt: new Date('2023-10-02'), // Newer date
        board: testBoard,
        createdBy: user,
      }),
    ];
    await postRepository.save(recentPosts);

    const popularPosts = [
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
    await postRepository.save(popularPosts);

    const today = new Date().toISOString().split('T')[0];
    const visitor = createVisitor({ date: today });
    await visitorRepository.save(visitor);

    const visitorEntry = createVisitorEntry({ date: today });
    await visitorEntryRepository.save(visitorEntry);

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    expect(response.body).toEqual({
      visitors: visitor.count,
      recentPosts: expect.arrayContaining([
        expect.objectContaining({
          title: 'Hot Post 1', // Higher hotScore
          board: expect.objectContaining({ name: testBoard.name }),
        }),
        expect.objectContaining({
          title: 'Hot Post 2',
          board: expect.objectContaining({ name: testBoard.name }),
        }),
        expect.objectContaining({
          title: 'Recent Post 2', // Should appear first (newer)
          board: expect.objectContaining({ name: testBoard.name }),
        }),
        expect.objectContaining({
          title: 'Recent Post 1',
          board: expect.objectContaining({ name: testBoard.name }),
        }),
      ]),
      popularPosts: expect.arrayContaining([
        expect.objectContaining({
          title: 'Hot Post 1', // Higher hotScore
          hotScore: 95,
          board: expect.objectContaining({ name: testBoard.name }),
        }),
        expect.objectContaining({
          title: 'Hot Post 2',
          hotScore: 85,
          board: expect.objectContaining({ name: testBoard.name }),
        }),
        expect.objectContaining({
          title: 'Recent Post 2', // Should appear first (newer)
          board: expect.objectContaining({ name: testBoard.name }),
        }),
        expect.objectContaining({
          title: 'Recent Post 1',
          board: expect.objectContaining({ name: testBoard.name }),
        }),
      ]),
      noticesPosts: [],
    });

    const dashboardDto = plainToInstance(DashboardSummaryDto, response.body);

    const errors = await validate(dashboardDto, {
      forbidUnknownValues: true, // 알 수 없는 필드 금지
      whitelist: true, // 허용되지 않은 필드 제거
      validationError: { target: false }, // 오류 메시지 간결화
    });

    if (errors.length > 0) {
      console.error('Validation Errors:', errors);
      throw new Error('DTO 검증 실패');
    }

    expect(dashboardDto.recentPosts[0].nickname).toBeDefined();
    expect(dashboardDto.popularPosts[0].hotScore).toBeGreaterThan(0);
  });
});
