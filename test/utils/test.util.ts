// test-utils.ts
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import * as request from 'supertest';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';
import { DbModule } from '@/db/db.module';
import { TestDbModule } from './test-db.e2e.module';
import { createUserDto } from '@/users/factory/user.factory';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { AppModule } from '@/app.module';

export interface TestApp {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
}

export async function setupTestApp(): Promise<TestApp> {
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });

  const moduleBuilder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideModule(DbModule)
    .useModule(TestDbModule);

  const module: TestingModule = await moduleBuilder.compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  return {
    app,
    module,
    dataSource: module.get(DataSource),
  };
}

export async function truncateAllTables(dataSource: DataSource) {
  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    await dataSource.query(
      `TRUNCATE ${entity.tableName} RESTART IDENTITY CASCADE`,
    );
  }
}

export async function truncatePostsTable(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();
    await queryRunner.query(`
      TRUNCATE TABLE post 
      RESTART IDENTITY 
      CASCADE
    `);
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function signUpAndLogin(
  app: INestApplication,
  userInfo: ReturnType<typeof createUserDto> = createUserDto(),
): Promise<string> {
  // 회원가입
  await request(app.getHttpServer()).post('/users').send(userInfo).expect(201);

  // 로그인
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email: userInfo.email,
      password: userInfo.password,
    } satisfies LoginUserDto)
    .expect(200);

  return loginResponse.body.access_token;
}

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// 데이터베이스 상태 검증 유틸
export function expectDatabaseToContain(
  repository: Repository<any>,
  criteria: any,
) {
  return async () => {
    const result = await repository.findOneBy(criteria);
    expect(result).toBeDefined();
  };
}

// 공통 응답 검증기
export function expectErrorResponse(
  response: request.Response,
  status: number,
  message?: string,
) {
  expect(response.status).toBe(status);
  if (message) {
    expect(response.body.message).toBe(message);
  }
}
