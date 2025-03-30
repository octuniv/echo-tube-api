import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { TestDbModule } from './test-db.e2e.module';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { PostsModule } from '@/posts/posts.module';
import { DbModule } from '@/db/db.module';
import { DataSource, Repository } from 'typeorm';
import { MakeCreateUserDtoFaker } from '@/users/faker/user.faker';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { VisitorModule } from '@/visitor/visitor.module';

const truncateTables = async (dataSource: DataSource) => {
  const queryRunner = dataSource.createQueryRunner(); // QueryRunner 생성
  await queryRunner.connect(); // 데이터베이스 연결
  await queryRunner.startTransaction(); // 트랜잭션 시작

  try {
    await queryRunner.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE'); // users, post 테이블 TRUNCATE
    await queryRunner.query(
      'TRUNCATE TABLE refresh_token RESTART IDENTITY CASCADE',
    ); // refresh_token 테이블 TRUNCATE
    await queryRunner.commitTransaction(); // 트랜잭션 커밋
  } catch (err) {
    await queryRunner.rollbackTransaction(); // 오류 발생 시 롤백
    throw err;
  } finally {
    await queryRunner.release(); // QueryRunner 해제
  }
};

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, DbModule, UsersModule, PostsModule, VisitorModule],
    })
      .overrideModule(DbModule)
      .useModule(TestDbModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  beforeEach(async () => {
    await truncateTables(dataSource);
  });

  afterAll(async () => {
    await truncateTables(dataSource);
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should return 200 and a JWT token when credentials are valid', async () => {
      const userDto = MakeCreateUserDtoFaker();
      await userRepository.save({
        name: userDto.name,
        nickname: userDto.nickname,
        email: userDto.email,
        passwordHash: bcrypt.hashSync(userDto.password, 10),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userDto.email,
          password: userDto.password,
        } satisfies LoginUserDto)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.name).toEqual(userDto.name);
      expect(response.body.nickname).toEqual(userDto.nickname);
      expect(response.body.email).toEqual(userDto.email);
    });

    it('should return 401 Unauthorized if credentials are invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        } satisfies LoginUserDto);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 if the password is entered incorrectly.', async () => {
      const userDto = MakeCreateUserDtoFaker();
      await userRepository.save({
        name: userDto.name,
        nickname: userDto.nickname,
        email: userDto.email,
        passwordHash: bcrypt.hashSync(userDto.password, 10),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userDto.email,
          password: 'wrongpassword@@',
        } satisfies LoginUserDto)
        .expect(401);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/refresh', () => {
    const userDto = MakeCreateUserDtoFaker();
    let jwt_token: {
      access_token: string;
      refresh_token: string;
    };

    beforeEach(async () => {
      await userRepository.save({
        name: userDto.name,
        nickname: userDto.nickname,
        email: userDto.email,
        passwordHash: bcrypt.hashSync(userDto.password, 10),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userDto.email,
          password: userDto.password,
        } satisfies LoginUserDto);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');

      jwt_token = {
        access_token: response.body.access_token,
        refresh_token: response.body.refresh_token,
      };

      await new Promise((resolve) => setTimeout(resolve, 1001));
    });

    it('should return a new access_token if refresh_token is valid', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: jwt_token.refresh_token })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });

    it('should return 401 Unauthorized if refresh_token is invalid', async () => {
      const refreshToken = 'invalid_refresh_token';

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);
    });

    it('should return 401 Unauthorized if refresh_token is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(401);
    });

    it('should not handle concurrent refresh token requests', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: jwt_token.refresh_token }),
        request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refresh_token: jwt_token.refresh_token }),
      ]);

      expect(responses.every((res) => res.status === 200)).toBeFalsy();
    });
  });

  describe('/auth/validate-token (GET)', () => {
    const userDto = MakeCreateUserDtoFaker();
    let user: User;
    let jwt_token: {
      access_token: string;
      refresh_token: string;
    };

    beforeEach(async () => {
      user = await userRepository.save({
        name: userDto.name,
        nickname: userDto.nickname,
        email: userDto.email,
        passwordHash: bcrypt.hashSync(userDto.password, 10),
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userDto.email,
          password: userDto.password,
        } satisfies LoginUserDto);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');

      jwt_token = {
        access_token: response.body.access_token,
        refresh_token: response.body.refresh_token,
      };
    });

    it('should return { valid: true } for a valid access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/validate-token')
        .set('Authorization', `Bearer ${jwt_token.access_token}`)
        .expect(200);

      expect(response.body).toEqual({ valid: true });
    });

    it('should return { valid: false } for an expired or invalid access token', async () => {
      const expiredToken = jwtService.sign(
        { sub: user.id, email: user.email },
        { expiresIn: '-1s' },
      );

      const response = await request(app.getHttpServer())
        .get('/auth/validate-token')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(200);

      expect(response.body).toEqual({ valid: false });
    });

    it('should throw UnauthorizedException if Authorization header is missing', async () => {
      await request(app.getHttpServer())
        .get('/auth/validate-token')
        .expect(401);
    });
  });
});
