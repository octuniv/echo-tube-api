import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { setupTestApp } from './utils/test.util';

describe('CategoriesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    app = testApp.app;
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  it('/categories (GET) - 성공', () => {
    const expectedCategories = [
      {
        name: '커뮤니티',
        allowedSlugs: ['free'],
      },
      {
        name: '공지사항',
        allowedSlugs: ['notices'],
      },
    ];

    return request(app.getHttpServer())
      .get('/categories')
      .expect(200)
      .then((response) => {
        expectedCategories.forEach((category) => {
          expect(response.body).toContainEqual(
            expect.objectContaining(category),
          );
        });
      });
  });
});
