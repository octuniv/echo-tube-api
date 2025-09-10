import * as dotenv from 'dotenv';
import * as request from 'supertest';
import { LoginUserDto } from '@/auth/dto/login-user.dto';
import { User } from '@/users/entities/user.entity';
import { createUserDto } from '@/users/factory/user.factory';
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { Message } from '@/message/entities/message.entity';
import { CreateMessageDto } from '@/message/dto/create-message.dto';
import {
  MessageErrors,
  MessageResponses,
} from '@/message/constants/message.constants';

const userInfos = Array(3)
  .fill('')
  .map(() => createUserDto());

const envFile = `.env.${process.env.NODE_ENV || 'production'}`;
dotenv.config({ path: envFile });

const SYSTEM_USER = {
  email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
  password: process.env.SYSTEM_USER_PASSWORD || 'system1234',
};

describe('Messages - /messages (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  let userRepository: Repository<User>;
  let messageRepository: Repository<Message>;

  let adminToken: string;
  let admin: User;
  let accessTokens: string[];
  let users: User[];

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
  }, 15000);

  beforeAll(async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: SYSTEM_USER.email,
        password: SYSTEM_USER.password,
      } satisfies LoginUserDto)
      .expect(200);

    adminToken = loginResponse.body.access_token;

    admin = await userRepository.findOne({
      where: { email: SYSTEM_USER.email },
    });

    expect(admin).toBeDefined();
    expect(admin).toBeInstanceOf(User);
  });

  beforeAll(async () => {
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

    expect(accessTokens).toHaveLength(3);
    expect(users).toHaveLength(3);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await messageRepository.clear();
  });

  describe('1. 메시지 전송 (POST /messages)', () => {
    it('1.1: 일반 사용자가 1:1 메시지 전송 성공', async () => {
      const sendMessageDto = {
        receiverId: users[1].id,
        content: `안녕하세요 ${users[1].nickname}님!`,
      } satisfies CreateMessageDto;

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(sendMessageDto)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          senderNickname: users[0].nickname,
          content: sendMessageDto.content,
          isRead: false,
          createdAt: expect.any(String),
          isNotice: false,
        }),
      );

      const receivedMessage = await messageRepository.findOne({
        where: { id: response.body.id },
      });

      expect(receivedMessage).toBeInstanceOf(Message);
      expect(receivedMessage.content).toBe(sendMessageDto.content);
      expect(receivedMessage.receiverId).toEqual(users[1].id);
      expect(receivedMessage.senderId).toEqual(users[0].id);
    });

    it('1.2: 관리자가 공지 메시지 전송 성공', async () => {
      const noticeMessageDto = {
        content: '시스템 점검 안내',
        isNotice: true,
      } satisfies CreateMessageDto;

      const allUsers = await userRepository.find();

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(noticeMessageDto)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          noticeId: expect.any(String),
          content: noticeMessageDto.content,
          recipientCount: allUsers.length,
          createdAt: expect.any(String),
        }),
      );

      const sentMessages = await messageRepository.find({
        where: {
          content: noticeMessageDto.content,
          isNotice: true,
        },
        relations: ['sender', 'receiver'],
      });

      expect(sentMessages).toHaveLength(allUsers.length);

      sentMessages.forEach((msg) => {
        expect(msg.sender.id).toEqual(admin.id);
      });

      const receiverIds = sentMessages.map((msg) => msg.receiver.id);
      allUsers.forEach((user) => {
        expect(receiverIds).toContain(user.id);
      });
    });

    it('1.3: 인증되지 않은 사용자 (401 Unauthorized)', async () => {
      const sendMessageDto = {
        receiverId: users[1].id,
        content: `안녕하세요 ${users[1].nickname}님!`,
      } satisfies CreateMessageDto;

      await request(app.getHttpServer())
        .post('/messages')
        .send(sendMessageDto)
        .expect(401);
    });

    it('1.4: 공지 메시지 전송 시 일반 사용자 권한 거부 (403 Forbidden)', async () => {
      const noticeMessageDto = {
        content: '시스템 점검 안내',
        isNotice: true,
      } satisfies CreateMessageDto;

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(noticeMessageDto)
        .expect(403);

      expect(response.body.message).toBe(MessageErrors.FORBIDDEN_NOTICE);
    });

    it('1.5: 존재하지 않는 수신자에게 메시지 전송 (404 Not Found)', async () => {
      const notSendingMessageDto = {
        receiverId: 9999999,
        content: `NOTEXIST`,
      } satisfies CreateMessageDto;

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(notSendingMessageDto)
        .expect(404);

      expect(response.body.message).toBe(MessageErrors.RECEIVER_NOT_FOUND);
    });

    it('1.6: 필수 필드 누락 (400 Bad Request)', async () => {
      const wrongMessageDto = {
        receiverId: users[1].id,
      };

      await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(wrongMessageDto)
        .expect(400);
    });

    it('1.7: 공지 메시지 전송 시 receiverId 포함 (유효성 검사)', async () => {
      const noticeMessageDto = {
        receiverId: users[0].id,
        content: '시스템 점검 안내',
        isNotice: true,
      } satisfies CreateMessageDto;

      const allUsers = await userRepository.find();

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(noticeMessageDto)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          noticeId: expect.any(String),
          content: noticeMessageDto.content,
          recipientCount: allUsers.length,
          createdAt: expect.any(String),
        }),
      );
    });
  });

  describe('2. 받은 메시지 목록 조회 (GET /messages)', () => {
    beforeEach(async () => {
      const noticeMessageDto = {
        content: '시스템 점검 안내',
        isNotice: true,
      } satisfies CreateMessageDto;

      await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(noticeMessageDto)
        .expect(201);

      await Promise.all(
        [1, 2, 3, 4, 5].map(async (seq) => {
          const sendMessageDto = {
            receiverId: users[1].id,
            content: `안녕하세요 ${users[1].nickname}님! ${seq}`,
          } satisfies CreateMessageDto;

          await request(app.getHttpServer())
            .post('/messages')
            .set('Authorization', `Bearer ${accessTokens[0]}`)
            .send(sendMessageDto)
            .expect(201);
        }),
      );
    });

    it('2.1: 메시지 목록 조회 성공 (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages')
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body).toHaveLength(6);

      expect(response.body[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          preview: `안녕하세요 ${users[1].nickname}님! 5...`,
          senderNickname: users[0].nickname,
          isRead: false,
          createdAt: expect.any(String),
        }),
      );

      expect(response.body[1]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          preview: `안녕하세요 ${users[1].nickname}님! 4...`,
          senderNickname: users[0].nickname,
          isRead: false,
          createdAt: expect.any(String),
        }),
      );

      expect(response.body[2]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          preview: `안녕하세요 ${users[1].nickname}님! 3...`,
          senderNickname: users[0].nickname,
          isRead: false,
          createdAt: expect.any(String),
        }),
      );

      expect(response.body[3]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          preview: `안녕하세요 ${users[1].nickname}님! 2...`,
          senderNickname: users[0].nickname,
          isRead: false,
          createdAt: expect.any(String),
        }),
      );

      expect(response.body[4]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          preview: `안녕하세요 ${users[1].nickname}님! 1...`,
          senderNickname: users[0].nickname,
          isRead: false,
          createdAt: expect.any(String),
        }),
      );

      expect(response.body[5]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          preview: '[공지] 시스템 점검 안내...',
          senderNickname: admin.nickname,
          isRead: false,
          createdAt: expect.any(String),
        }),
      );
    });

    it('2.2: 인증되지 않은 사용자 (401 Unauthorized)', async () => {
      await request(app.getHttpServer()).get('/messages').expect(401);
    });

    it('2.3: 메시지가 없는 경우 빈 배열 반환', async () => {
      await messageRepository.clear();

      const response = await request(app.getHttpServer())
        .get('/messages')
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('3. 메시지 상세 조회 (GET /messages/:id)', () => {
    let messageId: number;

    let sendMessageDto: CreateMessageDto;

    beforeEach(async () => {
      sendMessageDto = {
        receiverId: users[1].id,
        content: `안녕하세요 ${users[1].nickname}님!`,
      } satisfies CreateMessageDto;

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(sendMessageDto)
        .expect(201);

      messageId = response.body.id;
    });

    it('3.1: 메시지 상세 조회 및 자동 읽음 처리 성공 (200 OK)', async () => {});
    it('3.1: 메시지 상세 조회 및 자동 읽음 처리 성공 (200 OK)', async () => {
      const beforeRead = await messageRepository.findOne({
        where: { id: messageId },
      });

      expect(beforeRead.isRead).toBeFalsy();

      const response = await request(app.getHttpServer())
        .get(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(200);

      expect(response.body).toEqual({
        id: messageId,
        senderNickname: users[0].nickname,
        content: sendMessageDto.content,
        isRead: true,
        createdAt: expect.any(String),
        isNotice: false,
      });

      const afterRead = await messageRepository.findOne({
        where: { id: messageId },
      });

      expect(afterRead.isRead).toBeTruthy();
    });

    it('3.2: 존재하지 않는 메시지 조회 (404 Not Found)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/9999999`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(404);

      expect(response.body.message).toBe(MessageErrors.MESSAGE_NOT_FOUND);
    });
    it('3.3: 다른 사용자의 메시지 조회 시도 (404 Not Found)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens[2]}`)
        .expect(404);

      expect(response.body.message).toBe(MessageErrors.MESSAGE_NOT_FOUND);
    });

    it('3.4: 인증되지 않은 사용자 (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .get(`/messages/${messageId}`)
        .expect(401);
    });
  });

  describe('메시지 삭제 (DELETE /messages/:id)', () => {
    let messageId: number;

    let sendMessageDto: CreateMessageDto;

    beforeEach(async () => {
      sendMessageDto = {
        receiverId: users[1].id,
        content: `안녕하세요 ${users[1].nickname}님!`,
      } satisfies CreateMessageDto;

      const response = await request(app.getHttpServer())
        .post('/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(sendMessageDto)
        .expect(201);

      messageId = response.body.id;
    });

    it('4.1: 메시지 삭제 성공 (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(200);

      expect(response.body.message).toBe(MessageResponses.DELETED);

      const deleteMessage = await messageRepository.findOne({
        where: { id: messageId },
        withDeleted: true,
      });
      expect(deleteMessage).toBeInstanceOf(Message);
      expect(deleteMessage.deletedAt).not.toBeNull();
      expect(deleteMessage.id).toBe(messageId);
    });

    it('4.2: 존재하지 않는 메시지 삭제 시도 (404 Not Found)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/messages/9999999`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(404);

      expect(response.body.message).toBe(MessageErrors.MESSAGE_NOT_FOUND);
    });

    it('4.3: 다른 사용자의 메시지 삭제 시도 (404 Not Found)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens[2]}`)
        .expect(404);

      expect(response.body.message).toBe(MessageErrors.MESSAGE_NOT_FOUND);
    });

    it('4.4: 인증되지 않은 사용자 (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .delete(`/messages/${messageId}`)
        .expect(401);
    });
  });
});
