// src/db/seeds/01-initial-users.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@/users/entities/user-role.enum';
import { BaseSeeder } from './base.seeder';

export default class InitialUserSeeder extends BaseSeeder implements Seeder {
  private readonly SYSTEM_USER = {
    email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
    password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
    name: 'System',
    nickname: 'system',
    role: UserRole.ADMIN,
  };

  private readonly BOT_ACCOUNT = {
    email: process.env.BOT_EMAIL || 'bot@example.com',
    password: process.env.BOT_PASSWORD || 'bot123456',
    name: 'Bot',
    nickname: 'bot',
    role: UserRole.BOT,
  };

  // 테스터 유저 여러 명을 쉽게 추가할 수 있도록 배열로 정의
  private readonly TESTER_USERS = [
    {
      email: process.env.TESTER_EMAIL || 'test@example.com',
      password: process.env.TESTER_PASSWORD || 'tester123456',
      name: 'Tester',
      nickname: 'tester',
      role: UserRole.USER,
    },
    {
      email: process.env.TESTER2_EMAIL || 'test2@example.com',
      password: process.env.TESTER2_PASSWORD || 'tester123456',
      name: 'Tester2',
      nickname: 'tester2',
      role: UserRole.USER,
    },
  ];

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const userRepo = dataSource.getRepository(User);

      // 시스템 유저, 봇 계정, 테스터 계정들을 하나의 목록으로 통합
      const usersToSeed = [
        this.SYSTEM_USER,
        this.BOT_ACCOUNT,
        ...this.TESTER_USERS,
      ];

      for (const userData of usersToSeed) {
        const existing = await userRepo.findOneBy({ email: userData.email });
        if (!existing) {
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await userRepo.save({
            name: userData.name,
            nickname: userData.nickname,
            email: userData.email,
            passwordHash: hashedPassword,
            role: userData.role,
          });
        }
      }
    });
  }
}
