// src/db/seeds/07-messages-test.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { BaseSeeder } from './base.seeder';
import { Message } from '@/message/entities/message.entity';

export default class TestMessageSeeder extends BaseSeeder implements Seeder {
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
      const messageRepo = dataSource.getRepository(Message);

      // 1. 테스터 유저 조회
      const testUsers = await Promise.all(
        this.TESTER_USERS.map(async (testUser) => {
          const user = await userRepo.findOneBy({
            email: testUser.email,
            role: UserRole.USER,
          });
          if (!user) {
            throw new Error(`Test user not found: ${testUser.email}`);
          }
          return user;
        }),
      );

      const sender = testUsers[0]; // tester
      const receiver = testUsers[1]; // tester2

      // 2. tester -> tester2 로 15개의 메시지 생성 및 저장
      // 시작 시간: 현재 시점
      const baseTime = new Date();

      const messagesToCreate = Array.from({ length: 15 }, (_, index) =>
        messageRepo.create({
          senderId: sender.id,
          receiverId: receiver.id,
          content: `This is test message #${index + 1} from tester to tester2`,
          isNotice: false,
          isRead: index % 2 === 0, // 짝수 번째 메시지는 읽음 처리 (테스트 용도)
          createdAt: new Date(baseTime.getTime() + index * 1000), // ✅ 1초씩 증가: #1은 가장 오래됨, #15가 가장 최신
          updatedAt: new Date(baseTime.getTime() + index * 1000), // ✅ updatedAt도 동일하게 맞춤
        }),
      );

      await messageRepo.insert(messagesToCreate);
    });
  }
}
