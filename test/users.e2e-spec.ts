import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@/users/entities/user.entity';
import * as request from 'supertest';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
  MakeUserEntityFaker,
} from '@/users/faker/user.faker';
import { AppModule } from '@/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DbModule } from '@/db/db.module';
import { TestE2EDbModule } from './test-db.e2e.module';
import { CreateUserDto } from '@/users/dto/create-user.dto';

describe('User - /users (e2e)', () => {
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

  describe('/users (POST)', () => {
    it('should create a user', async () => {
      const createUserDto = MakeCreateUserDtoFaker();

      const response = await request(app.getHttpServer())
        .post('/users')
        .send(createUserDto)
        .expect(201);

      expect(response.body).toMatchObject({
        email: createUserDto.email,
      });

      const createdUser = await userRepository.findOne({
        where: { email: createUserDto.email },
      });

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe(createUserDto.email);
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({ password: 'password123' })
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
    });

    it('should return 400 if email is already existed', async () => {
      const user = await userRepository.save(MakeUserEntityFaker());
      const existUserDto = {
        name: user.name,
        email: user.email,
        password: user.passwordHash,
      } satisfies CreateUserDto;

      const response = await request(app.getHttpServer())
        .post('/users')
        .send(existUserDto)
        .expect(400);

      expect(response.body.message).toContain(
        `This email ${existUserDto.email} is already existed!`,
      );
    });
  });

  describe('/users/:email (GET)', () => {
    it('should return a user by email', async () => {
      const user = await userRepository.save(MakeUserEntityFaker());

      const response = await request(app.getHttpServer())
        .get(`/users/${user.email}`)
        .expect(200);

      expect(response.body.email).toBe(user.email);
    });

    it('should return 404 if user does not exist', async () => {
      await request(app.getHttpServer())
        .get('/users/nonexistent@example.com')
        .expect(404);
    });
  });

  describe('/users/:email (PATCH)', () => {
    it('should update the user password', async () => {
      const user = await userRepository.save(MakeUserEntityFaker());

      const newPasswordDto = MakeUpdateUserDtoFaker();

      const response = await request(app.getHttpServer())
        .patch(`/users/${user.email}`)
        .send(newPasswordDto)
        .expect(200);

      expect(response.body.passwordHash).toBe(newPasswordDto.password);

      const updatedUser = await userRepository.findOne({
        where: { email: user.email },
      });

      expect(updatedUser.passwordHash).toBe(newPasswordDto.password);
    });

    it('should return 404 if user is not found', async () => {
      await request(app.getHttpServer())
        .patch('/users/notfound@example.com')
        .send({ password: 'newpassword' })
        .expect(404);
    });
  });

  describe('/users/:email (DELETE)', () => {
    it('should delete the user account', async () => {
      const user = await userRepository.save(MakeUserEntityFaker());

      await request(app.getHttpServer())
        .delete(`/users/${user.email}`)
        .expect(200);

      const deletedUser = await userRepository.findOne({
        where: { email: user.email },
      });

      expect(deletedUser).toBeNull();
    });

    it('should return 404 if user is not found', async () => {
      await request(app.getHttpServer())
        .delete('/users/notfound@example.com')
        .expect(404);
    });
  });
});
