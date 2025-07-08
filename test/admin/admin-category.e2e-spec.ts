import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { CATEGORY_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';
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

describe('Admin Categories - /admin/categories (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let nonAdminToken: string;
  let categoryId: number;
  let anotherCategoryId: number;

  const TEST_CATEGORY_NAME = 'TEST_CATEGORY_FOR_E2E';
  const ANOTHER_CATEGORY_NAME = 'Another Category';
  const VALID_SLUG = 'valid-slug';
  const DUPLICATE_SLUG = 'duplicate-slug';

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
    it('should return 401 if non-login user accesses endpoint.', async () => {
      return request(app.getHttpServer()).get('/admin/categories').expect(401);
    });

    it('should return 403 if non-admin user accesses endpoint.', async () => {
      return request(app.getHttpServer())
        .get('/admin/categories')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('should return 200 if admin accesses endpoint.', async () => {
      return request(app.getHttpServer())
        .get('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('POST /admin/categories', () => {
    it('should create category', async () => {
      let dto: CreateCategoryDto = {
        name: TEST_CATEGORY_NAME,
        allowedSlugs: [VALID_SLUG],
      };

      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(201)
        .then((res) => {
          categoryId = res.body.id;
          expect(res.body.name).toBe(TEST_CATEGORY_NAME);
          expect(res.body.allowedSlugs).toEqual([VALID_SLUG]);
        });

      dto = {
        name: ANOTHER_CATEGORY_NAME,
        allowedSlugs: [DUPLICATE_SLUG],
      };
      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(201)
        .then((res) => {
          anotherCategoryId = res.body.id;
          expect(res.body.name).toBe(ANOTHER_CATEGORY_NAME);
          expect(res.body.allowedSlugs).toEqual([DUPLICATE_SLUG]);
        });
    });

    it('should return 400 if duplicate slug exists', async () => {
      const dto: CreateCategoryDto = {
        name: 'Duplicate Category',
        allowedSlugs: [VALID_SLUG],
      };

      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUG(VALID_SLUG),
          );
        });
    });

    it('should return 400 if allowedSlugs is empty', async () => {
      const dto: CreateCategoryDto = {
        name: 'Empty Slug Category',
        allowedSlugs: [],
      };

      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
          ]);
        });
    });

    it('should throw 409 error if category name already exists', async () => {
      const dto: CreateCategoryDto = {
        name: TEST_CATEGORY_NAME,
        allowedSlugs: ['some-other-slug'],
      };

      return request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
          );
        });
    });
  });

  describe('GET /admin/categories/validate-slug', () => {
    it('should return { isUsed: false } if slug does not exist', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-slug')
        .query({ slug: 'new-slug', categoryId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });
    });

    it('should check all categories if categoryId is omitted', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-slug')
        .query({ slug: 'new_slug' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });
    });

    it('should return { isUsed: false } if slug is used in same category', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-slug')
        .query({ slug: VALID_SLUG, categoryId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });
    });

    it('should return { isUsed: true } if slug is used in other category', async () => {
      if (categoryId === 1) return;

      const otherCategoryId = categoryId - 1;
      await request(app.getHttpServer())
        .get('/admin/categories/validate-slug')
        .query({ slug: VALID_SLUG, categoryId: otherCategoryId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: true });
    });

    it('should return 400 if slug is missing', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-slug')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /admin/categories/validate-name', () => {
    it('should return { isUsed: false } if name does not exist', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({ name: 'new-category-name' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });
    });

    it('should return { isUsed: true } if name exists in another category', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({
          name: TEST_CATEGORY_NAME,
          categoryId: anotherCategoryId,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: true });
    });

    it('should return { isUsed: false } if name exists in same category', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({
          name: TEST_CATEGORY_NAME,
          categoryId,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });
    });

    it('should return 400 if name is missing', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('name should not be empty');
        });
    });

    it('should return 400 if name is empty string', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({ name: '' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('name should not be empty');
        });
    });

    it('should return 400 if categoryId is not a number', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({
          name: 'new-category-name',
          categoryId: 'invalid',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'categoryId must be an integer number',
          );
        });
    });

    it('should work correctly with multiple categories', async () => {
      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({ name: 'totally-new-category' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });

      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({
          name: ANOTHER_CATEGORY_NAME,
          categoryId,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: true });

      await request(app.getHttpServer())
        .get('/admin/categories/validate-name')
        .query({
          name: TEST_CATEGORY_NAME,
          categoryId,
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect({ isUsed: false });
    });
  });

  describe('GET /admin/categories', () => {
    it('should return all categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.find(
        (cat: any) => cat.name === TEST_CATEGORY_NAME,
      );
      expect(found).toBeDefined();
      expect(found.id).toEqual(categoryId);
      expect(found.allowedSlugs).toEqual([VALID_SLUG]);
    });
  });

  describe('GET /admin/categories/:id', () => {
    it('should return category details with full DTO structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual({
        id: categoryId,
        name: 'TEST_CATEGORY_FOR_E2E',
        allowedSlugs: ['valid-slug'],
        boards: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 404 if category not found', async () => {
      const nonExistId = 999;
      return request(app.getHttpServer())
        .get(`/admin/categories/${nonExistId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
          );
        });
    });
  });

  describe('PATCH /admin/categories/:id', () => {
    it('should update category successfully', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated Category',
        allowedSlugs: [VALID_SLUG, 'new-slug'],
      };

      await request(app.getHttpServer())
        .patch(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(200)
        .then((res) => {
          expect(res.body.name).toBe('Updated Category');
          expect(res.body.allowedSlugs).toContain(VALID_SLUG);
          expect(res.body.allowedSlugs).toContain('new-slug');
        });
    });

    it('should return 400 if duplicate slug exists in other category', async () => {
      const updateDto: UpdateCategoryDto = {
        allowedSlugs: [DUPLICATE_SLUG],
      };

      await request(app.getHttpServer())
        .patch(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS([DUPLICATE_SLUG]),
          );
        });
    });

    it('should return 400 if allowedSlugs is empty', async () => {
      const dto: UpdateCategoryDto = {
        allowedSlugs: [],
      };

      await request(app.getHttpServer())
        .patch(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
          ]);
        });
    });

    it('should return 404 if category not found', async () => {
      const nonExistId = 999;
      const dto: UpdateCategoryDto = {
        name: 'Updated Category',
      };

      return request(app.getHttpServer())
        .patch(`/admin/categories/${nonExistId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
          );
        });
    });

    it('should return 409 if category name already exists', async () => {
      const anotherCategoryDto: CreateCategoryDto = {
        name: 'Another Category For Patch Test',
        allowedSlugs: ['another-slug-for-patch'],
      };

      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(anotherCategoryDto)
        .expect(201);

      const dto: UpdateCategoryDto = {
        name: anotherCategoryDto.name,
      };

      return request(app.getHttpServer())
        .patch(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
          );
        });
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('should delete category', () => {
      return request(app.getHttpServer())
        .delete(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should return 404 if category not found', async () => {
      const nonExistId = 999;
      return request(app.getHttpServer())
        .delete(`/admin/categories/${nonExistId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
          );
        });
    });
  });
});
