import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from './entities/message.entity';
import { User } from '@/users/entities/user.entity';
import {
  MessageListItemDto,
  MessageDetailDto,
} from './dto/message-response.dto';
import { UsersService } from '@/users/users.service';
import { MessageErrors, MessageResponses } from './constants/message.constants';
import { CreateNoticeResponseDto } from './dto/create-message-response.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    private usersService: UsersService,
  ) {}

  async create(sender: User, createMessageDto: CreateMessageDto) {
    const { receiverId, content, isNotice } = createMessageDto;
    if (isNotice && sender.role !== 'admin') {
      throw new ForbiddenException(MessageErrors.FORBIDDEN_NOTICE);
    }

    const now = new Date();

    if (isNotice) {
      const allUsers = await this.usersService.getAllActiveUsers();
      if (allUsers.length === 0) {
        return CreateNoticeResponseDto.create('none', content, 0, now);
      }

      const firstMessage = this.messageRepository.create({
        sender: sender,
        receiver: allUsers[0],
        content,
        isNotice: true,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      });
      const savedFirst = await this.messageRepository.save(firstMessage);
      const createdAtToUse = now;

      if (allUsers.length > 1) {
        const otherMessages = allUsers.slice(1).map((user) => ({
          senderId: sender.id,
          receiverId: user.id,
          content,
          isNotice: true,
          isRead: false,
          createdAt: createdAtToUse,
          updatedAt: createdAtToUse,
        }));
        await this.messageRepository.insert(otherMessages);
      }

      return CreateNoticeResponseDto.create(
        `notice-${savedFirst.id}`,
        content,
        allUsers.length,
        createdAtToUse,
      );
    }

    const receiver = await this.usersService.getUserById(receiverId);
    if (!receiver || receiver.deletedAt) {
      throw new NotFoundException(MessageErrors.RECEIVER_NOT_FOUND);
    }

    const message = this.messageRepository.create({
      sender: sender,
      receiver: receiver,
      content,
      isNotice: false,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    });
    const savedMessage = await this.messageRepository.save(message);

    const messageWithRelations = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender'],
    });

    return MessageDetailDto.fromEntity(messageWithRelations);
  }

  async findAll(
    receiver: User,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<MessageListItemDto>> {
    const validPage = Math.max(1, page);
    const skip = (validPage - 1) * limit;

    const totalItems = await this.messageRepository.count({
      where: {
        receiverId: receiver.id,
      },
    });

    const totalPages = Math.ceil(totalItems / limit);

    const messages = await this.messageRepository.find({
      where: {
        receiverId: receiver.id,
        deletedAt: null,
      },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: skip,
      take: limit,
    });

    const data = messages.map((msg) => MessageListItemDto.fromEntity(msg));

    return {
      data,
      currentPage: validPage,
      totalItems,
      totalPages,
    };
  }

  async findOne(id: number, receiver: User) {
    const message = await this.messageRepository.findOne({
      where: { id, receiverId: receiver.id },
      relations: ['sender'],
    });
    if (!message) {
      throw new NotFoundException(MessageErrors.MESSAGE_NOT_FOUND);
    }
    if (!message.isRead) {
      message.isRead = true;
      await this.messageRepository.save(message);
    }
    return MessageDetailDto.fromEntity(message);
  }

  async remove(id: number, user: User) {
    const message = await this.messageRepository.findOne({
      where: { id, receiverId: user.id },
    });
    if (!message) {
      throw new NotFoundException(MessageErrors.MESSAGE_NOT_FOUND);
    }
    await this.messageRepository.softDelete({ id: message.id });
    return { message: MessageResponses.DELETED };
  }
}
