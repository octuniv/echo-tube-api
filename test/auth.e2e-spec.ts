import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { TestE2EDbModule } from './test-db.e2e.module';
import { DbModule } from '@/db/db.module';
import { Repository } from 'typeorm';
import { MakeCreateUserDtoFaker } from '@/users/faker/user.faker';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import * as bcrypt from 'bcrypt';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

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
  });

  afterEach(async () => {
    await userRepository.clear(); // Clear data after each test
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should return 200 and a JWT token when credentials are valid', async () => {
      const userDto = MakeCreateUserDtoFaker();
      await userRepository.save({
        name: userDto.name,
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
    });

    it('should return 401 when credentials are invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        } satisfies LoginUserDto);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });
});
