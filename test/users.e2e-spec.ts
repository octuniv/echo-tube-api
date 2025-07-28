import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { User } from '@/users/entities/user.entity';
import * as request from 'supertest';
import {
  createUserDto,
  updateUserNicknameDto,
  updateUserPasswordDto,
} from '@/users/factory/user.factory';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { UpdateUserNicknameRequest } from '@/users/dto/update-user-nickname.dto';
import { CheckEmailRequest } from '@/users/dto/check-user-email.dto';
import { CheckNicknameRequest } from '@/users/dto/check-user-nickname.dto';
import { UpdateUserPasswordRequest } from '@/users/dto/update-user-password.dto';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { UserRole } from '@/users/entities/user-role.enum';

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let authToken: string;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  const userInfo = createUserDto();
  const anotherUserInfo = createUserDto();
  const updateUserPasswordRequest = updateUserPasswordDto();
  const updateUserNicknameRequest = updateUserNicknameDto();

  beforeAll(async () => {
    authToken = await signUpAndLogin(app, userInfo);
  });

  beforeAll(async () => {
    // sign up another user
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(anotherUserInfo)
      .expect(201);

    expect(response.body).toMatchObject({
      userId: expect.any(Number),
      email: anotherUserInfo.email,
      message: 'Successfully created account',
    });
  });

  describe('About creating User', () => {
    it('should return badrequest when some of the information is not included in the signUp', async () => {
      const anotherUserInfo = createUserDto();
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: anotherUserInfo.email,
          password: anotherUserInfo.password,
        })
        .expect(400);
    });

    it('should return badrequest to include undefined property in this signup.', async () => {
      const anotherUserInfo = createUserDto();
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          ...anotherUserInfo,
          role: UserRole.ADMIN,
        })
        .expect(400);

      expect(response.body.message).toContain('property role should not exist');
    });

    it('should return conflictException if you put an existed Email', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'John Doe',
          nickname: 'John',
          email: userInfo.email,
          password: userInfo.password,
        } satisfies CreateUserDto)
        .expect(409);

      expect(response.body).toMatchObject({
        message: `This email ${userInfo.email} is already existed!`,
      });
    });

    it('should return conflictException if you put an existed nickname', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'John Doe',
          nickname: userInfo.nickname,
          email: 'another@test.com',
          password: 'another1111',
        } satisfies CreateUserDto)
        .expect(409);

      expect(response.body).toMatchObject({
        message: `This nickname ${userInfo.nickname} is already existed!`,
      });
    });
  });

  describe('Check email duplication', () => {
    it('return true when looking up existing accounts', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/check-email')
        .send({ email: userInfo.email } satisfies CheckEmailRequest)
        .expect(200);

      expect(response.body).toEqual({ exists: true });
    });

    it('return false when looking up non-existing accounts', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/check-email')
        .send({ email: 'non-exist@email.com' } satisfies CheckEmailRequest)
        .expect(200);

      expect(response.body).toEqual({ exists: false });
    });
  });

  describe('Check nickname duplication', () => {
    it('return true when looking up existing accounts', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/check-nickname')
        .send({ nickname: userInfo.nickname } satisfies CheckNicknameRequest)
        .expect(200);

      expect(response.body).toEqual({ exists: true });
    });

    it('return false when looking up non-existing accounts', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/check-nickname')
        .send({ nickname: 'non-exists' } satisfies CheckNicknameRequest)
        .expect(200);

      expect(response.body).toEqual({ exists: false });
    });
  });

  describe('For the rest of the action without the token', () => {
    it('should not update and delete accounts that do not have access_token', async () => {
      const anotherUser = createUserDto();
      await userRepository.save({
        name: anotherUser.name,
        nickname: anotherUser.nickname,
        email: anotherUser.email,
        passwordHash: bcrypt.hashSync(anotherUser.password, 10),
      });

      await request(app.getHttpServer())
        .patch(`/users/password`)
        .send(updateUserPasswordRequest)
        .expect(401);

      await request(app.getHttpServer())
        .patch(`/users/nickname`)
        .send(updateUserNicknameRequest)
        .expect(401);

      await request(app.getHttpServer()).delete(`/users`).expect(401);
    });
  });

  describe('About updating nickname', () => {
    it('should throw conflictException when to update the user nickname if the nickname is already existed.', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/nickname`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nickname: anotherUserInfo.nickname,
        } satisfies UpdateUserNicknameRequest)
        .expect(409);

      expect(response.body).toMatchObject({
        message: `This nickname ${anotherUserInfo.nickname} is already existed!`,
      });
    });

    it('should throw unauthorized error when to update the user nickname with invalid JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/nickname`)
        .set('Authorization', `Bearer nothing`)
        .send(updateUserNicknameRequest)
        .expect(401);

      expect(response.body).toEqual({
        message: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('should throw badrequest error when to update empty nickname with valid JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/nickname`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nickname: '' } satisfies UpdateUserNicknameRequest)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: ['Nickname should not be empty'],
        statusCode: 400,
      });
    });

    it('should update the user nickname with valid JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/nickname`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateUserNicknameRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Nickname change successful.',
      });
    });
  });

  describe('About updating password', () => {
    it('should throw unauthorized error when update the user password with invalid JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/password`)
        .set('Authorization', `Bearer nothing`)
        .send(updateUserPasswordRequest)
        .expect(401);

      expect(response.body).toEqual({
        message: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('should throw badreqeust error when update empty password with valid JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/password`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: '' } satisfies UpdateUserPasswordRequest)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: ['Password should not be empty'],
        statusCode: 400,
      });
    });

    it('should update the user password with valid JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/password`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateUserPasswordRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Passcode change successful.',
      });
    });
  });

  describe('About deleting User', () => {
    it('should delete the user account with valid JWT', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Successfully deleted account',
      });

      const deletedUser = await userRepository.findOneBy({
        email: userInfo.email,
      });

      expect(deletedUser).toBeNull();

      const softDeletedInfoOfUser = await userRepository.findOne({
        where: {
          email: userInfo.email,
        },
        withDeleted: true,
      });
      expect(softDeletedInfoOfUser).not.toBeNull();
    });

    it('should throw unauthorized error if input wronged JWT Token.', async () => {
      const response = await request(app.getHttpServer())
        .delete('/users')
        .set('Authorization', `Bearer nothing`)
        .expect(401);

      expect(response.body).toEqual({
        message: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('even if the account is deleted, the nickname and e-mail should be able to be viewed.', async () => {
      // sign up a new user
      const forThisTestUser = createUserDto();

      let response = await request(app.getHttpServer())
        .post('/users')
        .send(forThisTestUser)
        .expect(201);

      expect(response.body).toMatchObject({
        email: forThisTestUser.email,
        message: 'Successfully created account',
      });

      // login
      response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: forThisTestUser.email,
          password: forThisTestUser.password,
        } satisfies LoginUserDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      const thisAuthToken = response.body.access_token;

      // delete account
      response = await request(app.getHttpServer())
        .delete(`/users`)
        .set('Authorization', `Bearer ${thisAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Successfully deleted account',
      });

      // check email duplication
      response = await request(app.getHttpServer())
        .post('/users/check-email')
        .send({ email: forThisTestUser.email } satisfies CheckEmailRequest)
        .expect(200);

      expect(response.body).toEqual({ exists: true });

      // check nickname duplication
      response = await request(app.getHttpServer())
        .post('/users/check-nickname')
        .send({
          nickname: forThisTestUser.nickname,
        } satisfies CheckNicknameRequest)
        .expect(200);

      expect(response.body).toEqual({ exists: true });
    });
  });
});
