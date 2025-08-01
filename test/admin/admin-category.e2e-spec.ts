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
import { CreateCategoryDto } from '@/admin/category/dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from '@/admin/category/dto/CRUD/update-category.dto';
import { CreateBoardDto } from '@/admin/board/dto/CRUD/create-board.dto';

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

    it('should return consistent error messages', async () => {
      const dto = { name: '', allowedSlugs: [] };
      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);

      expect(res.body.message).toContain(CATEGORY_ERROR_MESSAGES.NAME_REQUIRED);
      expect(res.body.message).toContain(
        CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
      );
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
            CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(dto.allowedSlugs),
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

  describe('POST /admin/categories - invalid slugs', () => {
    const validDto: CreateCategoryDto = {
      name: 'Test Category',
      allowedSlugs: ['valid-slug'],
    };

    it('should return 400 for uppercase slug', async () => {
      const dto = { ...validDto, allowedSlugs: ['InvalidSlug'] };
      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
          ]);
        });
    });

    it('should return 400 for special characters', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug@special'] };
      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
          ]);
        });
    });

    it('should return 400 for underscores', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug_with_underscore'] };
      await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
          ]);
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

  describe('PUT /admin/categories/:id', () => {
    it('should update category successfully', async () => {
      const updateDto: UpdateCategoryDto = {
        name: 'Updated Category',
        allowedSlugs: [VALID_SLUG, 'new-slug'],
      };

      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200)
        .then((res) => {
          expect(res.body.name).toBe('Updated Category');
          expect(res.body.allowedSlugs).toContain(VALID_SLUG);
          expect(res.body.allowedSlugs).toContain('new-slug');
        });
    });

    it('should require name and allowedSlugs in update', async () => {
      const dto = {} as UpdateCategoryDto;
      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('name must be a string');
          expect(res.body.message).toContain('allowedSlugs must be an array');
        });
    });

    it('should return 400 if duplicate slug exists in other category', async () => {
      const duplicateSlugDto: UpdateCategoryDto = {
        name: `duplicatedSlug${new Date().toISOString()}`,
        allowedSlugs: [DUPLICATE_SLUG],
      };

      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateSlugDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS([DUPLICATE_SLUG]),
          );
        });
    });

    it('should return 400 if allowedSlugs is empty', async () => {
      const emptySlugDto: UpdateCategoryDto = {
        name: `emptySlug${new Date().toISOString()}`,
        allowedSlugs: [],
      };

      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(emptySlugDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
          ]);
        });
    });

    it('should return 404 if category not found', async () => {
      const nonExistId = 999;

      const anotherDto: UpdateCategoryDto = {
        name: `another${new Date().toISOString()}`,
        allowedSlugs: [`another1122345`],
      };

      return request(app.getHttpServer())
        .put(`/admin/categories/${nonExistId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(anotherDto)
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

      const dulicateNameDto: UpdateCategoryDto = {
        allowedSlugs: ['notuplicatedslug11'],
        name: anotherCategoryDto.name,
      };

      return request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dulicateNameDto)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toEqual(
            CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
          );
        });
    });

    it('should handle concurrent slug updates correctly', async () => {
      const dto1: UpdateCategoryDto = {
        name: 'Cat1',
        allowedSlugs: ['shared-slug'],
      };
      const dto2: UpdateCategoryDto = {
        name: 'Cat2',
        allowedSlugs: ['shared-slug'],
      };

      // 첫 번째 업데이트는 성공
      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto1)
        .expect(200);

      // 두 번째 업데이트는 충돌
      await request(app.getHttpServer())
        .put(`/admin/categories/${anotherCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto2)
        .expect(400);
    });
  });

  describe('PUT /admin/categories/:id - invalid slugs', () => {
    const validDto: UpdateCategoryDto = {
      name: 'Updated Category',
      allowedSlugs: ['valid-slug'],
    };

    it('should return 400 for uppercase slug', async () => {
      const dto = { ...validDto, allowedSlugs: ['InvalidSlug'] };
      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
          ]);
        });
    });

    it('should return 400 for special characters', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug@special'] };
      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
          ]);
        });
    });

    it('should return 400 for underscores', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug_with_underscore'] };
      await request(app.getHttpServer())
        .put(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual([
            CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
          ]);
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

  describe('GET /admin/categories/available', () => {
    let categoryId1: number;
    let categoryId2: number;
    let board1Id: number;

    beforeAll(async () => {
      // 카테고리 생성
      const category1 = await createCategory('availableTest1', [
        'availableslug1',
        'availableslug2',
        'availableslug3',
      ]);
      categoryId1 = category1.id;

      const category2 = await createCategory('availableTest2', [
        'availableslug4',
        'availableslug5',
      ]);
      categoryId2 = category2.id;

      // 보드 생성
      const board1 = await createBoard(categoryId1, 'availableslug1');
      board1Id = board1.id;

      await createBoard(categoryId2, 'availableslug4');
    });

    afterAll(async () => {
      await deleteCategory(categoryId1);
      await deleteCategory(categoryId2);
      await checkToDeleteCategory(categoryId1);
      await checkToDeleteCategory(categoryId2);
    });

    async function createCategory(
      name: string,
      slugs: string[],
    ): Promise<{ id: number }> {
      const dto: CreateCategoryDto = { name, allowedSlugs: slugs };
      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(201);
      return { id: res.body.id };
    }

    async function createBoard(
      categoryId: number,
      slug: string,
    ): Promise<{ id: number }> {
      const res = await request(app.getHttpServer())
        .post('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Board ${slug}`,
          description: 'Test',
          categoryId,
          slug,
        } satisfies CreateBoardDto)
        .expect(201);
      return { id: res.body.id };
    }

    async function deleteCategory(categoryId: number) {
      return request(app.getHttpServer())
        .delete(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    }

    async function checkToDeleteCategory(categoryId: number) {
      await request(app.getHttpServer())
        .get(`/admin/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    }

    it('should return 401 if unauthenticated', () => {
      return request(app.getHttpServer())
        .get('/admin/categories/available')
        .expect(401);
    });

    it('should return 403 if non-admin user', () => {
      return request(app.getHttpServer())
        .get('/admin/categories/available')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('should return 200 with available slugs (new board)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/categories/available')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 카테고리 1의 사용 가능 슬러그: slug2, slug3
      const category1 = res.body.find((cat: any) => cat.id === categoryId1);
      expect(category1.availableSlugs.map((s: any) => s.slug)).toEqual([
        'availableslug2',
        'availableslug3',
      ]);

      // 카테고리 2의 사용 가능 슬러그: slug5
      const category2 = res.body.find((cat: any) => cat.id === categoryId2);
      expect(category2.availableSlugs.map((s: any) => s.slug)).toEqual([
        'availableslug5',
      ]);
    });

    it('should include current board slug when editing', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/available?boardId=${board1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 카테고리 1의 사용 가능 슬러그: slug1, slug2, slug3
      const category1 = res.body.find((cat: any) => cat.id === categoryId1);
      expect(category1.availableSlugs.map((s: any) => s.slug)).toEqual([
        'availableslug1',
        'availableslug2',
        'availableslug3',
      ]);
    });

    it('should return all categories even if some have no available slugs', async () => {
      // 기존 카테고리에 추가 슬러그 사용
      await createBoard(categoryId1, 'availableslug2');

      const res = await request(app.getHttpServer())
        .get('/admin/categories/available')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 카테고리 1의 사용 가능 슬러그: slug3
      const category1 = res.body.find((cat: any) => cat.id === categoryId1);
      expect(category1.availableSlugs.map((s: any) => s.slug)).toEqual([
        'availableslug3',
      ]);

      // 카테고리 2는 여전히 slug5만 사용 가능
      const category2 = res.body.find((cat: any) => cat.id === categoryId2);
      expect(category2.availableSlugs.map((s: any) => s.slug)).toEqual([
        'availableslug5',
      ]);
    });

    it('should work with multiple boards in same category', async () => {
      // 카테고리 1에 추가 슬러그 사용
      await createBoard(categoryId1, 'availableslug3');

      const res = await request(app.getHttpServer())
        .get('/admin/categories/available')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 카테고리 1의 사용 가능 슬러그: 없음
      const category1 = res.body.find((cat: any) => cat.id === categoryId1);
      expect(category1.availableSlugs).toEqual([]);
    });
  });
});
