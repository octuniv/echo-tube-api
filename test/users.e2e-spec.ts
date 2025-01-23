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
import * as bcrypt from 'bcrypt';

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
        message: 'Successfully created account',
      });
      expect(response.body.passwordHash).not.toBeDefined();

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
      const existedUserDto = {
        name: user.name,
        email: user.email,
        password: user.passwordHash,
      } satisfies CreateUserDto;

      const response = await request(app.getHttpServer())
        .post('/users')
        .send(existedUserDto)
        .expect(400);

      expect(response.body.message).toContain(
        `This email ${existedUserDto.email} is already existed!`,
      );
    });
  });

  describe('/users/:email (GET)', () => {
    it('should return a message that tells you the ID that exists', async () => {
      const user = await userRepository.save(MakeUserEntityFaker());

      const response = await request(app.getHttpServer())
        .get(`/users/${user.email}`)
        .expect(200);

      expect(response.text).toBe('true');
    });

    it('should return a message that tells you the ID that does not exist', async () => {
      const email = `nonexistent@example.com`;
      const response = await request(app.getHttpServer())
        .get(`/users/${email}`)
        .expect(200);

      expect(response.text).toBe('false');
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

      expect(response.body.passwordHash).not.toBeDefined();
      expect(response.body.message).toEqual('Passcode change successful.');

      const updatedUser = await userRepository.findOne({
        where: { email: user.email },
      });

      await expect(
        bcrypt.compare(newPasswordDto.password, updatedUser.passwordHash),
      ).resolves.toBeTruthy();
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

      const response = await request(app.getHttpServer())
        .delete(`/users/${user.email}`)
        .expect(200);

      expect(response.body.passwordHash).not.toBeDefined();
      expect(response.body.message).toEqual('Successfully deleted account');

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
