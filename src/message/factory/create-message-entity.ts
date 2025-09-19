// src/messages/test-helpers/create-message-entity.ts

import { faker } from '@faker-js/faker';
import { Message } from '../entities/message.entity';
import { createUserEntity } from '@/users/factory/user.factory';

/**
 * 테스트용 Message 엔티티 생성 헬퍼 함수
 * @param options any - 오버라이드할 필드 (TypeORM DeepPartial 충돌 방지를 위해 any 사용)
 * @returns Message
 */
export const createMessageEntity = (options: any = {}): Message => {
  const message = new Message();

  message.id = options.id ?? faker.number.int({ min: 1, max: 9999 });
  message.senderId = options.senderId ?? faker.number.int({ min: 1, max: 999 });
  message.receiverId =
    options.receiverId ?? faker.number.int({ min: 1, max: 999 });
  message.content = options.content ?? faker.lorem.sentences(2);
  message.isRead = options.isRead ?? false;
  message.isNotice = options.isNotice ?? false;
  message.createdAt = options.createdAt ?? faker.date.past();
  message.updatedAt = options.updatedAt ?? faker.date.recent();
  message.deletedAt = options.deletedAt ?? null;

  // 관계 필드 — sender / receiver
  message.sender = options.sender ?? createUserEntity({ id: message.senderId });
  message.receiver =
    options.receiver ?? createUserEntity({ id: message.receiverId });

  return message;
};
