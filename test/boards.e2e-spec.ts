import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DbModule } from '@/db/db.module';
import { CategoriesModule } from '@/categories/categories.module';
import { BoardsModule } from '@/boards/boards.module';
import { TestDbModule } from './test-db.e2e.module';
import { PostsModule } from '@/posts/posts.module';
import { UsersModule } from '@/users/users.module';

describe('CategoriesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        DbModule,
        CategoriesModule,
        BoardsModule,
        PostsModule,
        UsersModule,
      ],
    })
      .overrideModule(DbModule)
      .useModule(TestDbModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /boards', () => {
    it('should return boards recorded by seeder with correct DTO structure', async () => {
      // Request and assertions
      const response = await request(app.getHttpServer())
        .get('/boards')
        .expect(200);

      expect(response.body).toEqual([
        {
          id: 1,
          slug: 'free',
          name: '자유 게시판',
          description: null,
        },
      ]);

      // DTO structure validation
      response.body.forEach((board) => {
        expect(board).not.toHaveProperty('category');
        expect(board).not.toHaveProperty('posts');
        expect(Object.keys(board)).toEqual([
          'id',
          'slug',
          'name',
          'description',
        ]);
      });
    });
  });
});
