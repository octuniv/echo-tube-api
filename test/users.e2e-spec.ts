import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@/users/entities/user.entity';
import * as request from 'supertest';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
} from '@/users/faker/user.faker';
import { AppModule } from '@/app.module';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DbModule } from '@/db/db.module';
import { TestE2EDbModule } from './test-db.e2e.module';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '@/users/dto/create-user.dto';

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
  const updateUserDto = MakeUpdateUserDtoFaker();

  it('should return BadRequest when some of the information is not included in the signUp', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: userInfo.email,
        password: userInfo.password,
      })
      .expect(400);
  });

  it('should sign up a new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send(userInfo)
      .expect(201);

    expect(response.body).toMatchObject({
      email: userInfo.email,
      message: 'Successfully created account',
    });
  });

  it('should return BadRequest if you put an existed Email', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'John Doe',
        email: userInfo.email,
        password: userInfo.password,
      } satisfies CreateUserDto)
      .expect(400);

    expect(response.body).toMatchObject({
      message: `This email ${userInfo.email} is already existed!`,
    });
  });

  it('should log in and receive a JWT token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: userInfo.email,
        password: userInfo.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty('access_token');
    authToken = response.body.access_token;
  });

  it('should not update and delete accounts that do not match ths current account', async () => {
    const anotherUser = MakeCreateUserDtoFaker();
    await userRepository.save({
      name: anotherUser.name,
      email: anotherUser.email,
      passwordHash: bcrypt.hashSync(anotherUser.password, 10),
    });

    await request(app.getHttpServer())
      .patch(`/users/${anotherUser.email}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: 'AnotherPassword' })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/users/${anotherUser.email}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(401);
  });

  it('should update the user password with valid JWT', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/users/${userInfo.email}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ password: updateUserDto.password })
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'Passcode change successful.',
    });
  });

  it('should delete the user account with valid JWT', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/users/${userInfo.email}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      message: 'Successfully deleted account',
    });
  });

  it('should not update password without a valid JWT', async () => {
    await request(app.getHttpServer())
      .patch('/users/testuser@example.com')
      .send({ password: 'AnotherPassword' })
      .expect(401);
  });

  it('should not delete account without a valid JWT', async () => {
    await request(app.getHttpServer())
      .delete('/users/testuser@example.com')
      .expect(401);
  });
});
