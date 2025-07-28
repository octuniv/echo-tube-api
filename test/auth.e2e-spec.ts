import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { createUserDto } from '@/users/factory/user.factory';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { setupTestApp, truncateAllTables } from './utils/test.util';
import { VideoFactory } from '@/video-harvester/factory/video.factory';

const truncateUserTable = async (dataSource: DataSource) => {
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
  let module: TestingModule;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const testApp = await setupTestApp();

    ({ app, module, dataSource } = testApp);

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    dataSource = module.get<DataSource>(DataSource);
  }, 15000);

  beforeEach(async () => {
    await truncateUserTable(dataSource);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should return 200 and a JWT token when credentials are valid', async () => {
      const userDto = createUserDto();
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
      expect(response.body.user.name).toEqual(userDto.name);
      expect(response.body.user.nickname).toEqual(userDto.nickname);
      expect(response.body.user.email).toEqual(userDto.email);
      expect(response.body.user.role).toBeDefined();
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
      const userDto = createUserDto();
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
    const userDto = createUserDto();
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
    const userDto = createUserDto();
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

  describe('Role Guard', () => {
    const userDto = createUserDto();
    let jwt_token: {
      access_token: string;
      refresh_token: string;
    };

    beforeAll(async () => {
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

    it('should throw Forbidden when general user use a bot-only API', async () => {
      const videoPostDto = new VideoFactory().create();
      await request(app.getHttpServer())
        .post('/harvest/videos')
        .send(videoPostDto)
        .set('Authorization', `Bearer ${jwt_token.access_token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/boards/scraping-targets')
        .set('Authorization', `Bearer ${jwt_token.access_token}`)
        .expect(403);
    });
  });

  describe('POST /auth/logout', () => {
    let userDto: ReturnType<typeof createUserDto>;
    let loginResponse: request.Response;

    beforeEach(async () => {
      userDto = createUserDto();
      await userRepository.save({
        name: userDto.name,
        nickname: userDto.nickname,
        email: userDto.email,
        passwordHash: bcrypt.hashSync(userDto.password, 10),
      });
      loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: userDto.email,
          password: userDto.password,
        } satisfies LoginUserDto)
        .expect(200);
    });

    it('should successfully revoke refresh token and prevent reuse', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refresh_token: loginResponse.body.refresh_token })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: loginResponse.body.refresh_token })
        .expect(401);
    });

    it('should return 401 if refresh_token is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({})
        .expect(401);
    });

    it('should return 401 if refresh_token is invalid', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refresh_token: 'invalid-refresh-token' })
        .expect(401);
    });
  });
});
