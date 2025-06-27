import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { User } from '@/users/entities/user.entity';
import { createUserDto } from '@/users/factory/user.factory';
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { setupTestApp, truncateAllTables } from '../utils/test.util';
import { DataSource, Repository } from 'typeorm';
import { AdminCreateUserDto } from '@/users/dto/admin/admin-create-user-dto';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminUserDetailResponseDto } from '@/users/dto/admin/admin-user-detail-response.dto';

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
dotenv.config({ path: envFile });

const SYSTEM_USER = {
  email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
  password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
};

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let adminToken: string;
  let nonAdminToken: string;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  const createTestUser = async (overrides: Partial<User> = {}) => {
    const user = userRepository.create({
      name: 'Test User',
      nickname: `testuser_${Math.random().toString(36).substring(7)}`,
      email: `test_${Math.random().toString(36).substring(7)}@example.com`,
      passwordHash: bcrypt.hashSync('password123', 10),
      role: UserRole.USER,
      ...overrides,
    });
    return userRepository.save(user);
  };

  const normalUserInfo = createUserDto();

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
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(normalUserInfo)
      .expect(201);

    expect(response.body).toMatchObject({
      email: normalUserInfo.email,
      message: 'Successfully created account',
    });
  });

  beforeAll(async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: normalUserInfo.email,
        password: normalUserInfo.password,
      } satisfies LoginUserDto)
      .expect(200);

    nonAdminToken = loginResponse.body.access_token;
  });

  describe('Create User for admin', () => {
    let adminCreateUserDto: AdminCreateUserDto;

    beforeAll(() => {
      adminCreateUserDto = {
        ...createUserDto(),
        role: UserRole.ADMIN,
      };
    });

    it('should return 401 if user is not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .send(adminCreateUserDto)
        .expect(401);
    });

    it('should return 403 if user is not admin', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send(adminCreateUserDto)
        .expect(403);
    });

    it('should create user with specified role when admin', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adminCreateUserDto)
        .expect(201);

      expect(
        userRepository.findOneBy({ email: adminCreateUserDto.email }),
      ).resolves.toMatchObject({ name: adminCreateUserDto.name });
    });

    it('should return 400 if role is invalid', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...adminCreateUserDto,
          role: 'INVALID_ROLE',
        })
        .expect(400);
    });

    it('should return 409 if nickname is duplicated', async () => {
      const duplicatedEmailDto = {
        ...createUserDto(),
        nickname: adminCreateUserDto.nickname,
        role: UserRole.ADMIN,
      } satisfies AdminCreateUserDto;

      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicatedEmailDto)
        .expect(409);

      expect(res.body).toEqual({
        message: `This nickname ${duplicatedEmailDto.nickname} is already existed!`,
        error: 'Conflict',
        statusCode: 409,
      });
    });
  });

  describe('List users', () => {
    beforeAll(async () => {
      // 정렬 테스트용 유저 생성
      await createTestUser({ updatedAt: new Date('2023-01-01') });
      await createTestUser({ updatedAt: new Date('2024-01-01') });
      await createTestUser({ updatedAt: new Date('2025-01-01') });
    });

    it('should return paginated user list', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.currentPage).toBe(1);
          expect(res.body.totalItems).toBeGreaterThan(0);
        });
    });

    it('should return 400 for invalid page/limit', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .query({ page: 'abc', limit: 'xyz' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('updatedAt ASC sorting', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .query({ sort: 'updatedAt', order: 'ASC' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updatedAts = res.body.data.map((u: any) => new Date(u.updatedAt));
      expect(updatedAts).toEqual(
        [...updatedAts].sort((a, b) => a.getTime() - b.getTime()),
      );
    });

    it('updatedAt DESC sorting', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .query({ sort: 'updatedAt', order: 'DESC' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updatedAts = res.body.data.map((u: any) => new Date(u.updatedAt));
      expect(updatedAts).toEqual(
        [...updatedAts].sort((a, b) => b.getTime() - a.getTime()),
      );
    });
  });

  describe('Get user details', () => {
    it('should return user details including deletedAt', async () => {
      const anotherUserInfo = createUserDto();
      const user = await userRepository.save({
        name: anotherUserInfo.name,
        nickname: anotherUserInfo.nickname,
        email: anotherUserInfo.email,
        passwordHash: bcrypt.hashSync(anotherUserInfo.password, 10),
        role: UserRole.USER,
      });
      await userRepository.softDelete(user.id);

      await request(app.getHttpServer())
        .get(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe(user.id);
          expect(res.body.deletedAt).not.toBeNull();
        });
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/admin/users/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Update User', () => {
    let userInfo: CreateUserDto;
    let user: User;

    beforeAll(async () => {
      userInfo = createUserDto();
      user = await userRepository.save({
        name: userInfo.name,
        nickname: userInfo.nickname,
        email: userInfo.email,
        passwordHash: bcrypt.hashSync(userInfo.password, 10),
        role: UserRole.USER,
      });
    });

    afterAll(async () => {
      await userRepository.delete(user.id);
    });

    it('should update user role successfully', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.ADMIN })
        .expect(200);

      expect(
        userRepository.findOneBy({ email: user.email }),
      ).resolves.toMatchObject({
        role: UserRole.ADMIN,
      });
    });

    it('should return 409 if nickname is duplicated', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nickname: normalUserInfo.nickname })
        .expect(409);

      expect(res.body).toEqual({
        message: `This nickname ${normalUserInfo.nickname} is already existed!`,
        error: 'Conflict',
        statusCode: 409,
      });
    });

    it('should return 400 for empty nickname update', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nickname: '' })
        .expect(400);
    });
  });

  describe('Delete User', () => {
    let userInfo: CreateUserDto;
    let user: User;

    beforeAll(async () => {
      userInfo = createUserDto();
      user = await userRepository.save({
        name: userInfo.name,
        nickname: userInfo.nickname,
        email: userInfo.email,
        passwordHash: bcrypt.hashSync(userInfo.password, 10),
        role: UserRole.USER,
      });
    });

    it('should return 403 if non-admin tries to delete', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });

    it('should soft-delete user account', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.success).toBe(true);
        });
      // DB에서 deletedAt 확인
      const deletedUser = await userRepository.findOne({
        where: { id: user.id },
        withDeleted: true,
      });
      expect(deletedUser.deletedAt).not.toBeNull();
    });
  });

  describe('Search Users', () => {
    beforeAll(async () => {
      // 검색 테스트용 유저 생성
      await createTestUser({
        name: 'John Doe',
        nickname: 'john123',
        email: 'john.doe@example.com',
        role: UserRole.USER,
      });
      await createTestUser({
        name: 'Jane Smith',
        nickname: 'jane456',
        email: 'jane.smith@example.com',
        role: UserRole.ADMIN,
      });
    });

    it('search email', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ searchEmail: 'john' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toContain('john.doe@example.com');
    });

    it('search nickname', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ searchNickname: 'jane' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nickname).toBe('jane456');
    });

    it('filter by role', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ searchRole: UserRole.ADMIN })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(3); // Previous tests should be considered.
      expect(res.body.data[0].role).toBe(UserRole.ADMIN);
    });

    it('search and sort combination', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ searchEmail: 'john', sort: 'updatedAt', order: 'ASC' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toContain('john.doe@example.com');
    });

    it('search for non-existent users', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ searchEmail: 'notexist' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('Invalid alignment parameter', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ sort: 'invalid' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  const validateAdminUserResponse = (data: any): AdminUserDetailResponseDto => {
    const dto = plainToInstance(AdminUserDetailResponseDto, data);
    const errors = validateSync(dto);

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
    }

    return dto;
  };

  describe('Admin User Detail Response Validation', () => {
    let testUser: User;
    let adminUser: User;

    beforeAll(async () => {
      testUser = await createTestUser({
        name: 'Validation Test',
        nickname: 'val_tester',
        email: 'validation.test@example.com',
      });

      adminUser = await createTestUser({
        name: 'Validation Admin',
        nickname: 'val_admin',
        email: 'validation.admin@example.com',
        role: UserRole.ADMIN,
      });
    });

    afterAll(async () => {
      await userRepository.softDelete(testUser.id);
      await userRepository.softDelete(adminUser.id);
    });

    it('should validate single user response format', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dto = validateAdminUserResponse(res.body);
      expect(dto).toBeInstanceOf(AdminUserDetailResponseDto);
    });

    it('should validate list user response format', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const paginationData = res.body;

      expect(paginationData).toHaveProperty('data');
      expect(paginationData).toHaveProperty('totalItems');
      expect(paginationData).toHaveProperty('currentPage');

      paginationData.data.forEach((item: any) => {
        const dto = validateAdminUserResponse(item);
        expect(dto).toBeInstanceOf(AdminUserDetailResponseDto);
      });
    });

    it('should validate searching user response format', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users/search')
        .query({ searchNickname: 'val_tester' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const paginationData = res.body;

      expect(paginationData).toHaveProperty('data');
      expect(paginationData).toHaveProperty('totalItems');
      expect(paginationData).toHaveProperty('currentPage');

      paginationData.data.forEach((item: any) => {
        const dto = validateAdminUserResponse(item);
        expect(dto).toBeInstanceOf(AdminUserDetailResponseDto);
      });
    });

    it('should validate soft-deleted user response', async () => {
      await userRepository.softDelete(testUser.id);

      const res = await request(app.getHttpServer())
        .get(`/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dto = validateAdminUserResponse(res.body);
      expect(dto.deletedAt).toBeInstanceOf(Date);
      expect(dto.deletedAt).not.toBeNull();
    });
  });
});
