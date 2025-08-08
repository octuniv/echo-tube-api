import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { createUserDto } from '@/users/factory/user.factory';
import { User } from '@/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

const userInfos = Array(2)
  .fill('')
  .map(() => createUserDto());

describe('Comments - /comments (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  let userRepository: Repository<User>;
  let accessTokens: string[];
  let users: User[];

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  }, 15000);

  beforeAll(async () => {
    // Sign up and login for all users
    accessTokens = await Promise.all(
      userInfos.map(async (userInfo) => {
        const token = await signUpAndLogin(app, userInfo);
        if (!token) {
          throw new Error(
            `Failed to sign up or log in user: ${userInfo.email}`,
          );
        }
        return token;
      }),
    );

    // Find all users
    users = await Promise.all(
      userInfos.map(async (userInfo) => {
        const user = await userRepository.findOne({
          where: { email: userInfo.email },
        });
        if (!user) {
          throw new Error(`User not found: ${userInfo.email}`);
        }
        return user;
      }),
    );

    expect(accessTokens).toHaveLength(2);
    expect(users).toHaveLength(2);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });
});
