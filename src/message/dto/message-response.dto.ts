import { ApiProperty } from '@nestjs/swagger';
import { Message } from '../entities/message.entity';

export class MessageListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '관리자' })
  senderName: string;

  @ApiProperty({ example: '[공지] 점검 안내 드립니다...' })
  preview: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2025-04-01T10:00:00Z' })
  createdAt: Date;

  static fromEntity(message: Message): MessageListItemDto {
    return {
      id: message.id,
      senderName: message.sender.nickname,
      preview: message.isNotice
        ? `[공지] ${message.content.substring(0, 30)}...`
        : message.content.substring(0, 30) + '...',
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  }
}

export class MessageDetailDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '관리자' })
  senderName: string;

  @ApiProperty({ example: 'john_doe' })
  senderNickname: string;

  @ApiProperty({ example: '점검 안내 드립니다. 04/05 새벽 2시~4시...' })
  content: string;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2025-04-01T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: true })
  isNotice: boolean;

  static fromEntity(message: Message): MessageDetailDto {
    return {
      id: message.id,
      senderName: message.sender.name,
      senderNickname: message.sender.nickname,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      isNotice: message.isNotice,
    };
  }
}
