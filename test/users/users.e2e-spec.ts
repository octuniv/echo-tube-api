import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '@/db/db.module';
import { User } from '@/users/entities/user.entity';
import { UsersModule } from '@/users/users.module';
import * as request from 'supertest';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
} from '@/users/faker/user.faker';

describe('User - /users (e2e)', () => {
  let app: INestApplication;
  let user: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DbModule, UsersModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // # TODO: apply ValidationPipe
    await app.init();
  });

  it('Create [Post /users/]', async () => {
    return request(app.getHttpServer())
      .post('/users')
      .send(MakeCreateUserDtoFaker())
      .expect(201)
      .then(({ body }) => {
        expect(body).toBeDefined();
      });
  });

  it('Update user [PATCH /users/update/:id]', async () => {
    const updateUserDto = MakeUpdateUserDtoFaker();
    return request(app.getHttpServer())
      .patch(`/users/update/${user.id}`)
      .send(updateUserDto)
      .expect(200)
      .then(({ body }) => {
        expect(body.id).toEqual(user.id);
        expect(body.password).toEqual(updateUserDto.password);
      });
  });

  // # TODO : apply Guard to update user (change password)

  // # TODO : apply remove user

  afterAll(async () => {
    await app.close();
  });
});
