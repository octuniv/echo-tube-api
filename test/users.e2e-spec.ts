import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@/users/entities/user.entity';
import * as request from 'supertest';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserNicknameRequestFaker,
  MakeUpdateUserPasswordRequestFaker,
} from '@/users/faker/user.faker';
import { AppModule } from '@/app.module';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DbModule } from '@/db/db.module';
import { TestE2EDbModule } from './test-db.e2e.module';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { LoginUserDto } from '@/auth/dto/login-user.dto';

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let authToken: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
    expect(response.body.nickName).toEqual(userInfo.nickName);
    expect(response.body.email).toEqual(userInfo.email);

    authToken = response.body.access_token;
  });

  describe('About creating User', () => {
    it('should return BadRequest when some of the information is not included in the signUp', async () => {
      const anotherUserInfo = MakeCreateUserDtoFaker();
      await request(app.getHttpServer())
        .post('/users')
        .send({
          email: anotherUserInfo.email,
          password: anotherUserInfo.password,
        })
        .expect(400);
    });

    it('should return BadRequest if you put an existed Email', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'John Doe',
          nickName: 'John',
          email: userInfo.email,
          password: userInfo.password,
        } satisfies CreateUserDto)
        .expect(400);

      expect(response.body).toMatchObject({
        message: `This email ${userInfo.email} is already existed!`,
      });
    });

    it('should return BadRequest if you put an existed nickName', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'John Doe',
          nickName: userInfo.nickName,
          email: 'another@test.com',
          password: 'another1111',
        } satisfies CreateUserDto)
        .expect(400);

      expect(response.body).toMatchObject({
        message: `This nickName ${userInfo.nickName} is already existed!`,
      });
    });
  });

  describe('For the rest of the action without the token', () => {
    it('should not update and delete accounts that do not have access_token', async () => {
      const anotherUser = MakeCreateUserDtoFaker();
      await userRepository.save({
        name: anotherUser.name,
        nickName: anotherUser.nickName,
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
    it('should update the user password with valid JWT', async () => {
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
  });
});
