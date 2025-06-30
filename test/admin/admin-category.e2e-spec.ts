import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { INestApplication } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as request from 'supertest';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from '../utils/test.util';
import { DataSource } from 'typeorm';
import { CreateCategoryDto } from '@/categories/dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from '@/categories/dto/CRUD/update-category.dto';

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
dotenv.config({ path: envFile });

const SYSTEM_USER = {
  email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
  password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
};

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let nonAdminToken: string;
  let categoryId: number;
  const TEST_CATEGORY_NAME = 'TEST_CATEGORY_FOR_E2E';

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, dataSource } = testApp);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  beforeAll(async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: SYSTEM_USER.email,
        password: SYSTEM_USER.password,
      } satisfies LoginUserDto)
      .expect(200);

    adminToken = loginResponse.body.access_token;
  });

  beforeAll(async () => {
    nonAdminToken = await signUpAndLogin(app);
  });

  describe('Authenticaton/Authorization Test', () => {
    it('should return 401 if non-login user access this entry.', async () => {
      return request(app.getHttpServer()).get('/admin/categories').expect(401);
    });

    it('should return 403 if non-admin user access this entry.', async () => {
      return request(app.getHttpServer())
        .get('/admin/categories')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('should return 200 if admin access this entry.', async () => {
      return request(app.getHttpServer())
        .get('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('POST /admin/categories', () => {
    it('should create category', async () => {
      return request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: TEST_CATEGORY_NAME,
          allowedSlugs: ['tech'],
        } satisfies CreateCategoryDto)
        .expect(201)
        .then((res) => {
          categoryId = res.body.id;
          expect(res.body.name).toBe(TEST_CATEGORY_NAME);
          expect(res.body.allowedSlugs).toEqual(['tech']);
        });
    });
  });

  describe('GET /admin/categories', () => {
    it('should return all categories', async () => {
      return request(app.getHttpServer())
        .get('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          const found = res.body.find(
            (cat: any) => cat.name === TEST_CATEGORY_NAME,
          );
          expect(found).toBeDefined();
          expect(found.allowedSlugs).toEqual(['tech']);
        });
    });
  });

  describe('GET /admin/categories/:id', () => {
    it('should return category details', async () => {
      return request(app.getHttpServer())
        .get(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe(categoryId);
          expect(res.body.boardIds).toEqual([]);
        });
    });
  });

  describe('PATCH /admin/categories/:id', () => {
    it('should update category name', async () => {
      return request(app.getHttpServer())
        .patch(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Tech' } satisfies UpdateCategoryDto)
        .expect(200)
        .then((res) => {
          expect(res.body.name).toBe('Updated Tech');
        });
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('should delete category', () => {
      return request(app.getHttpServer())
        .delete(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
