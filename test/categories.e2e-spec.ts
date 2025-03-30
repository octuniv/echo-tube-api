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

  it('/categories (GET) - 성공', () => {
    return request(app.getHttpServer())
      .get('/categories')
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual([
          {
            name: '커뮤니티',
            allowedSlugs: ['free'],
          },
        ]);
      });
  });
});
