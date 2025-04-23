import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Board } from '@/boards/entities/board.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { setupTestApp } from './utils/test.util';
import { ScrapingTargetBoardDto } from '@/boards/dto/scraping-target-board.dto';

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

      expect(response.body).toHaveLength(3);

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

      expect(response.body).toContainEqual(
        expect.objectContaining({
          id: expect.any(Number),
          slug: 'nestjs',
          name: 'NESTJS',
          description: null,
          requiredRole: UserRole.BOT,
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

  describe('GET /scraping-tagets', () => {
    let access_token: string;

    beforeAll(async () => {
      const bot_email = process.env.BOT_EMAIL;
      const bot_password = process.env.BOT_PASSWORD;
      expect(bot_email).toBeDefined();
      expect(bot_password).toBeDefined();

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: bot_email,
          password: bot_password,
        })
        .expect(200);

      expect(loginResponse.body).toBeDefined();
      expect(loginResponse.body.user.role).toEqual(UserRole.BOT);
      access_token = loginResponse.body.access_token;
    });

    it('should return datas with ScrapingTargetBoardDto', async () => {
      const response = await request(app.getHttpServer())
        .get('/boards/scraping-targets')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      expect(response.body).toContainEqual(
        expect.objectContaining({
          slug: 'nestjs',
          name: 'NESTJS',
        }),
      );

      response.body.forEach((responseDto: ScrapingTargetBoardDto) => {
        expect(Object.keys(responseDto)).toEqual(['slug', 'name']);
      });
    });
  });
});
