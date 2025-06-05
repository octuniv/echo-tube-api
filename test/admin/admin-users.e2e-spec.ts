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
  });

  describe('List users', () => {
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
      await request(app.getHttpServer())
        .patch(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nickname: normalUserInfo.nickname })
        .expect(409);
    });

    it('should return 400 for empty nickname update', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nickname: '' })
        .expect(400);
    });
  });

  describe('delete User', () => {
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
});
