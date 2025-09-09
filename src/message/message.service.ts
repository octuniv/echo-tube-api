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
import { MessageErrorMessages } from './constants/message.constants';

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
      throw new ForbiddenException(MessageErrorMessages.FORBIDDEN_NOTICE);
    }

    if (isNotice) {
      const allUsers = await this.usersService.getAllActiveUsers();

      const noticeMessages = allUsers.map((user) =>
        this.messageRepository.create({
          senderId: sender.id,
          receiverId: user.id,
          content,
          isNotice: true,
        }),
      );

      return await this.messageRepository.save(noticeMessages);
    }

    const receiver = await this.usersService.getUserById(receiverId);
    if (!receiver || receiver.deletedAt) {
      throw new NotFoundException(MessageErrorMessages.RECEIVER_NOT_FOUND);
    }

    const message = this.messageRepository.create({
      senderId: sender.id,
      receiverId,
      content,
      isNotice: false,
    });

    return await this.messageRepository.save(message);
  }

  async findAll(receiver: User) {
    const messages = await this.messageRepository.find({
      where: {
        receiverId: receiver.id,
      },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });

    return messages.map((msg) => MessageListItemDto.fromEntity(msg));
  }

  async findOne(id: number, receiver: User) {
    const message = await this.messageRepository.findOne({
      where: { id, receiverId: receiver.id },
      relations: ['sender'],
    });

    if (!message) {
      throw new NotFoundException(MessageErrorMessages.MESSAGE_NOT_FOUND);
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
      throw new NotFoundException(MessageErrorMessages.MESSAGE_NOT_FOUND);
    }

    await this.messageRepository.softDelete({ id: message.id });
    return { message: '메시지가 삭제되었습니다.' };
  }
}
