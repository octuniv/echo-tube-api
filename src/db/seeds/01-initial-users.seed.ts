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
  };

  private readonly BOT_ACCOUNT = {
    email: process.env.BOT_EMAIL || 'bot@example.com',
    password: process.env.BOT_PASSWORD || 'bot123456',
  };

  private readonly TESTER_USER = {
    email: process.env.TESTER_EMAIL || 'test@example.com',
    password: process.env.TESTER_PASSWORD || 'tester123456',
  };

  private readonly USERS = [
    {
      ...this.SYSTEM_USER,
      name: 'System',
      nickname: 'system',
      role: UserRole.ADMIN,
    },
    {
      ...this.BOT_ACCOUNT,
      name: 'Bot',
      nickname: 'bot',
      role: UserRole.BOT,
    },
    {
      ...this.TESTER_USER,
      name: 'Tester',
      nickname: 'tester',
      role: UserRole.USER,
    },
  ];

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const userRepo = dataSource.getRepository(User);

      for (const userData of this.USERS) {
        const existing = await userRepo.findOneBy({
          email: userData.email,
        });

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
