import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@/users/entities/user.entity';
import * as request from 'supertest';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserNicknameRequestFaker,
  MakeUpdateUserPasswordRequestFaker,
} from '@/users/faker/user.faker';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersModule } from '@/users/users.module';
import { AuthModule } from '@/auth/auth.module';
import { PostsModule } from '@/posts/posts.module';
import { DbModule } from '@/db/db.module';
import { TestE2EDbModule } from './test-db.e2e.module';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { UpdateUserNicknameRequest } from '@/users/dto/update-user-nickname.dto';
import { CheckEmailRequest } from '@/users/dto/check-user-email.dto';
import { CheckNicknameRequest } from '@/users/dto/check-user-nickname.dto';
import { UpdateUserPasswordRequest } from '@/users/dto/update-user-password.dto';

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let authToken: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DbModule, UsersModule, AuthModule, PostsModule],
    })
      .overrideModule(DbModule)
      .useModule(TestE2EDbModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    const queryRunner = dataSource.createQueryRunner(); // QueryRunner 생성
    await queryRunner.connect(); // 데이터베이스 연결
    await queryRunner.startTransaction(); // 트랜잭션 시작

    try {
      await queryRunner.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE'); // users 테이블 TRUNCATE
      await queryRunner.commitTransaction(); // 트랜잭션 커밋
    } catch (err) {
      await queryRunner.rollbackTransaction(); // 오류 발생 시 롤백
      throw err;
    } finally {
      await queryRunner.release(); // QueryRunner 해제
    }
    await app.close();
  });

  const userInfo = MakeCreateUserDtoFaker();
  const anotherUserInfo = MakeCreateUserDtoFaker();
  const updateUserPasswordRequest = MakeUpdateUserPasswordRequestFaker();
  const updateUserNicknameRequest = MakeUpdateUserNicknameRequestFaker();

  beforeAll(async () => {
    // sign up a new user
    let response = await request(app.getHttpServer())
      .post('/users')
      .send(userInfo)
      .expect(201);

    expect(response.body).toMatchObject({
      email: userInfo.email,
      message: 'Successfully created account',
    });

    // login
    response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: userInfo.email,
        password: userInfo.password,
      } satisfies LoginUserDto)
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');
    expect(response.body.name).toEqual(userInfo.name);
    expect(response.body.nickname).toEqual(userInfo.nickname);
    expect(response.body.email).toEqual(userInfo.email);

    authToken = response.body.access_token;
  });

  beforeAll(async () => {
    // sign up another user
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(anotherUserInfo)
      .expect(201);

    expect(response.body).toMatchObject({
      email: anotherUserInfo.email,
      message: 'Successfully created account',
    });
  });

  describe('About creating User', () => {
    it('should return badrequest when some of the information is not included in the signUp', async () => {
      const anotherUserInfo = MakeCreateUserDtoFaker();
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: anotherUserInfo.email,
          password: anotherUserInfo.password,
        })
        .expect(400);
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
      const anotherUser = MakeCreateUserDtoFaker();
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
        message: ['nickname should not be empty'],
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
        message: ['password should not be empty'],
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
      const forThisTestUser = MakeCreateUserDtoFaker();

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
