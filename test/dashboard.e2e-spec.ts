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
import { PostsService } from '@/posts/posts.service';
import { PostResponseDto } from '@/posts/dto/post-response.dto';

const userInfo = createUserDto();

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let user: User;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let postsService: PostsService;
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
    postsService = module.get<PostsService>(PostsService);
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

  it('/dashboard/summary (GET) should return dashboard summary with correct recent and popular posts', async () => {
    const boards = await boardsService.findAll();
    const testBoard = boards.find(
      (board) => board.categorySlug.slug === 'free',
    );
    const noticeBoard = boards.find(
      (board) => board.categorySlug.slug === 'notices',
    );

    const today = new Date().toISOString().split('T')[0];
    const visitor = createVisitor({ date: today });
    await visitorRepository.save(visitor);

    const visitorEntry = createVisitorEntry({ date: today });
    await visitorEntryRepository.save(visitorEntry);

    const notices = [
      createPost({
        title: 'Notice 1',
        content: 'Notice Content 1',
        board: noticeBoard,
        createdBy: user,
        createdAt: new Date('2023-10-01'),
      }),
      createPost({
        title: 'Notice 2',
        content: 'Notice Content 2',
        board: noticeBoard,
        createdBy: user,
        createdAt: new Date('2023-10-02'),
      }),
    ];
    await postRepository.save(notices);

    const postA = createPost({
      title: 'Popular Post A',
      content: 'Content A',
      views: 100,
      commentsCount: 10,
      likesCount: 20,
      createdAt: new Date('2023-09-30T00:00:00Z'),
      board: testBoard,
      createdBy: user,
    });

    const postB = createPost({
      title: 'Popular Post B',
      content: 'Content B',
      views: 200,
      commentsCount: 5,
      likesCount: 30,
      createdAt: new Date('2023-10-01T00:00:00Z'),
      board: testBoard,
      createdBy: user,
    });

    const recentPost1 = createPost({
      title: 'Recent Post 1',
      content: 'Content 1',
      createdAt: new Date('2023-10-01T10:00:00Z'),
      board: testBoard,
      createdBy: user,
    });

    const recentPost2 = createPost({
      title: 'Recent Post 2',
      content: 'Content 2',
      createdAt: new Date('2023-10-02T08:00:00Z'),
      board: testBoard,
      createdBy: user,
    });

    await postRepository.save([postA, postB, recentPost1, recentPost2]);

    await postsService.updateHotScores();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .expect(200);

    expect(response.body.visitors).toBe(visitor.count);

    expect(response.body.noticesPosts).toHaveLength(2);
    expect(response.body.noticesPosts[0].title).toBe('Notice 2');
    expect(response.body.noticesPosts[1].title).toBe('Notice 1');

    expect(response.body.recentPosts).toHaveLength(4);
    expect(response.body.recentPosts[0].title).toBe('Recent Post 2');
    expect(response.body.recentPosts[1].title).toBe('Recent Post 1');
    expect(response.body.recentPosts[2].title).toBe('Popular Post B');
    expect(response.body.recentPosts[3].title).toBe('Popular Post A');

    expect(response.body.popularPosts).toHaveLength(4);
    expect(response.body.popularPosts[0].title).toBe('Popular Post B');
    expect(response.body.popularPosts[1].title).toBe('Popular Post A');

    const HOUR = 1000 * 60 * 60;
    const now = Date.now();

    const ageB = now - new Date('2023-10-01T00:00:00Z').getTime();
    const ageInHoursB = ageB / HOUR;
    const expectedScoreB =
      200 * 1.5 + 5 * 2 + 30 * 3 + (1 / Math.pow(ageInHoursB + 2, 1.5)) * 100;

    const ageA = now - new Date('2023-09-30T00:00:00Z').getTime();
    const ageInHoursA = ageA / HOUR;
    const expectedScoreA =
      100 * 1.5 + 10 * 2 + 20 * 3 + (1 / Math.pow(ageInHoursA + 2, 1.5)) * 100;

    expect(response.body.popularPosts[0].hotScore).toBeCloseTo(
      expectedScoreB,
      2,
    );
    expect(response.body.popularPosts[1].hotScore).toBeCloseTo(
      expectedScoreA,
      2,
    );

    const popularTitles = response.body.popularPosts.map(
      (p: PostResponseDto) => p.title,
    );
    const recentTitles = response.body.recentPosts.map(
      (p: PostResponseDto) => p.title,
    );
    expect(popularTitles).not.toContain('Notice 1');
    expect(popularTitles).not.toContain('Notice 2');
    expect(recentTitles).not.toContain('Notice 1');
    expect(recentTitles).not.toContain('Notice 2');
  });
});
