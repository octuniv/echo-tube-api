import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Board } from '@/boards/entities/board.entity';
import { UserRole } from '@/users/entities/user-role.enum';
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

  describe('GET /boards', () => {
    it('should return boards with correct DTO structure including requiredRole', async () => {
      const response = await request(app.getHttpServer())
        .get('/boards')
        .expect(200);

      expect(response.body).toHaveLength(2);

      expect(response.body).toContainEqual(
        expect.objectContaining({
          id: expect.any(Number),
          slug: 'free',
          name: '자유 게시판',
          description: null,
          requiredRole: UserRole.USER,
        }),
      );

      expect(response.body).toContainEqual(
        expect.objectContaining({
          id: expect.any(Number),
          slug: 'notices',
          name: '공지 게시판',
          description: null,
          requiredRole: UserRole.ADMIN,
        }),
      );

      // Validate DTO structure
      response.body.forEach((board: Board) => {
        expect(board).not.toHaveProperty('category');
        expect(board).not.toHaveProperty('posts');
        expect(Object.keys(board)).toEqual([
          'id',
          'slug',
          'name',
          'description',
          'requiredRole',
        ]);
      });
    });
  });
});
