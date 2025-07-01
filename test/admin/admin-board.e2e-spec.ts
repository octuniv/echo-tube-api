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
import { CreateBoardDto } from '@/boards/dto/CRUD/create-board.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { UpdateBoardDto } from '@/boards/dto/CRUD/update-board.dto';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminBoardResponseDto } from '@/boards/dto/admin/admin-board-response.dto';

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
dotenv.config({ path: envFile });

const SYSTEM_USER = {
  email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
  password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
};

const validateAdminBordResponse = (data: any): AdminBoardResponseDto => {
  const dto = plainToInstance(AdminBoardResponseDto, data);
  const errors = validateSync(dto);

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  }

  return dto;
};

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let nonAdminToken: string;
  let testCategoryId: number;
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

  beforeAll(async () => {
    await request(app.getHttpServer())
      .post('/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: TEST_CATEGORY_NAME,
        allowedSlugs: ['test'],
      } satisfies CreateCategoryDto)
      .expect(201)
      .then((res) => {
        testCategoryId = Number(res.body.id);
        expect(res.body.name).toBe(TEST_CATEGORY_NAME);
        expect(res.body.allowedSlugs).toEqual(['test']);
      });
  });

  describe('Authenticaton/Authorization Test', () => {
    it('should return 401 if non-login user access this entry.', async () => {
      return request(app.getHttpServer()).get('/admin/boards').expect(401);
    });

    it('should return 403 if non-admin user access this entry.', async () => {
      return request(app.getHttpServer())
        .get('/admin/boards')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('should return 200 if admin access this entry.', async () => {
      return request(app.getHttpServer())
        .get('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('POST /admin/boards', () => {
    let dto: CreateBoardDto;

    beforeAll(() => {
      dto = {
        slug: 'test-board',
        name: 'Test Board',
        description: 'Test Description',
        requiredRole: UserRole.USER,
        type: BoardPurpose.GENERAL,
        categoryId: testCategoryId,
      };
    });

    it('should create board', async () => {
      return request(app.getHttpServer())
        .post('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(201)
        .then((res) => {
          const dto = validateAdminBordResponse(res.body);
          expect(dto).toBeInstanceOf(AdminBoardResponseDto);
        });
    });

    it('should throw a not found error if dto has non-existed category', async () => {
      const invalidCategoryDto: CreateBoardDto = {
        ...dto,
        categoryId: 9999,
      };
      return request(app.getHttpServer())
        .post('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidCategoryDto)
        .expect(404);
    });

    it('should throw bad request if dto has invalid role', async () => {
      const invalidRoleDto = {
        ...dto,
        requiredRole: 'invalid',
      };
      return request(app.getHttpServer())
        .post('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidRoleDto)
        .expect(400);
    });

    it('should throw bad request if dto has invalid type', async () => {
      const invalidTypeDto = {
        ...dto,
        type: 'invalid',
      };
      return request(app.getHttpServer())
        .post('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTypeDto)
        .expect(400);
    });

    it('should throw bad request if dto is missed any properties.', async () => {
      const invalidDto = {
        description: 'Test Description',
        requiredRole: UserRole.USER,
        type: BoardPurpose.GENERAL,
        categoryId: testCategoryId,
      };
      return request(app.getHttpServer())
        .post('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /admin/boards', () => {
    it('should return boardResponse datas', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      res.body.forEach(validateAdminBordResponse);
    });

    it('should match schema snapshot', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/boards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /admin/boards/:id', () => {
    let getCategoryId: number;

    beforeAll(() => {
      getCategoryId = testCategoryId;
    });

    it('should return boardResponse data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/boards/${getCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dto = validateAdminBordResponse(res.body);
      expect(dto).toBeInstanceOf(AdminBoardResponseDto);
    });

    it('should throw a not found error if id does not exist', async () => {
      return request(app.getHttpServer())
        .get(`/admin/boards/9999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should throw bad request error if id is invalid', async () => {
      return request(app.getHttpServer())
        .get(`/admin/boards/abc`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('PATCH /admin/boards/:id', () => {
    let dto: UpdateBoardDto;
    let updateCategoryId: number;

    beforeAll(() => {
      dto = {
        name: 'Updated Board',
      };
      updateCategoryId = testCategoryId;
    });

    it('should be successful in updating board', async () => {
      return request(app.getHttpServer())
        .patch(`/admin/boards/${updateCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(200)
        .then((res) => {
          validateAdminBordResponse(res.body);
          expect(res.body.name).toEqual(dto.name);
          expect(res.body.categoryId).toEqual(updateCategoryId);
        });
    });

    it('should throw a not found error if id does not exist', async () => {
      return request(app.getHttpServer())
        .patch(`/admin/boards/9999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(404);
    });

    it('should throw bad request error if id is invalid', async () => {
      return request(app.getHttpServer())
        .patch(`/admin/boards/abc`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto)
        .expect(400);
    });

    it('should throw a not found error if categoryId does not exist', async () => {
      const dtoWithWrongCategoryId = {
        ...dto,
        categoryId: 9999,
      };
      return request(app.getHttpServer())
        .patch(`/admin/boards/${updateCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dtoWithWrongCategoryId)
        .expect(404)
        .then((res) => {
          expect(res.body.message).toEqual('찾는 카테고리가 존재하지 않습니다');
        });
    });

    it('should throw validation error if dto has wrong type data.', async () => {
      const dtoWithWrongTypeData = {
        ...dto,
        type: 'invalid',
      };
      return request(app.getHttpServer())
        .patch(`/admin/boards/${updateCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dtoWithWrongTypeData)
        .expect(400);
    });
  });

  describe('DELETE /admin/boards/:id', () => {
    let deleteCategoryId: number;

    beforeAll(() => {
      deleteCategoryId = testCategoryId;
    });

    it('should success to delete board', async () => {
      return request(app.getHttpServer())
        .delete(`/admin/boards/${deleteCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should throw a not found error If you delete a board that does not exist', async () => {
      return request(app.getHttpServer())
        .delete(`/admin/boards/${deleteCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should throw bad request error to enter invalid id', async () => {
      return request(app.getHttpServer())
        .delete(`/admin/boards/abc`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
