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

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const userRepo = dataSource.getRepository(User);
      const existing = await userRepo.findOneBy({
        email: this.SYSTEM_USER.email,
      });

      if (!existing) {
        const hashedPassword = await bcrypt.hash(this.SYSTEM_USER.password, 10);
        await userRepo.save({
          name: 'System',
          nickname: 'system',
          email: this.SYSTEM_USER.email,
          passwordHash: hashedPassword,
          role: UserRole.ADMIN,
        });
      }
    });
  }
}
