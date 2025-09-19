import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageService } from './message.service';
import { Message } from './entities/message.entity';
import { UsersService } from '@/users/users.service';
import { User } from '@/users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MessageErrors, MessageResponses } from './constants/message.constants';
import { createUserEntity } from '@/users/factory/user.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import { createMessageEntity } from './factory/create-message-entity';
import { MessageDetailDto } from './dto/message-response.dto';
import { CreateNoticeResponseDto } from './dto/create-message-response.dto';

function isMessageDetailDto(
  dto: CreateNoticeResponseDto | MessageDetailDto,
): dto is MessageDetailDto {
  return (dto as MessageDetailDto).isNotice !== undefined;
}

describe('MessageService', () => {
  let service: MessageService;
  let messageRepository: Repository<Message>;
  let usersService: UsersService;

  const mockUser = createUserEntity({
    id: 1,
    name: 'John Doe',
    nickname: 'johndoe',
    email: 'john@example.com',
    passwordHash: 'hashed',
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    sentMessages: [],
    receivedMessages: [],
    posts: [],
    comments: [],
  });

  const mockAdmin: User = { ...mockUser, id: 999, role: UserRole.ADMIN };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: UsersService,
          useValue: {
            getAllActiveUsers: jest.fn(),
            findUserByNickname: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn(),
            insert: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageRepository = module.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ForbiddenException if non-admin tries to send notice', async () => {
      const dto: CreateMessageDto = {
        receiverNickname: 'target',
        content: 'Hi',
        isNotice: true,
      };
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        new ForbiddenException(MessageErrors.FORBIDDEN_NOTICE),
      );
    });

    it('should send notice to all users and return CreateNoticeResponseDto if admin', async () => {
      const dto: CreateMessageDto = {
        receiverNickname: 'target',
        content: 'System Notice',
        isNotice: true,
      };

      const activeUsers = [
        createUserEntity({ id: 2, name: 'User2' }),
        createUserEntity({ id: 3, name: 'User3' }),
      ];

      jest
        .spyOn(usersService, 'getAllActiveUsers')
        .mockResolvedValue(activeUsers);

      const firstMessageData = {
        senderId: mockAdmin.id,
        receiverId: activeUsers[0].id,
        content: dto.content,
        isNotice: true,
      };

      const savedFirstMessage = createMessageEntity({
        ...firstMessageData,
        sender: mockAdmin,
        receiver: activeUsers[0],
        id: 1001,
        createdAt: new Date('2025-04-05T10:00:00Z'),
      });

      jest.spyOn(messageRepository, 'create').mockImplementation((data) => {
        const receiver =
          activeUsers.find((user) => user.id === data.receiverId) ||
          activeUsers[0];

        return createMessageEntity({
          ...data,
          sender: mockAdmin,
          receiver,
          id: data.id || undefined,
          isRead: data.isRead ?? false,
          isNotice: data.isNotice ?? false,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          deletedAt: data.deletedAt || null,
        });
      });

      jest
        .spyOn(messageRepository, 'save')
        .mockResolvedValue(savedFirstMessage);

      jest.spyOn(messageRepository, 'insert').mockResolvedValue({} as any);

      const result = await service.create(mockAdmin, dto);

      expect(usersService.getAllActiveUsers).toHaveBeenCalled();
      expect(messageRepository.create).toHaveBeenCalledTimes(1);
      expect(messageRepository.save).toHaveBeenCalledTimes(1);
      expect(messageRepository.insert).toHaveBeenCalledTimes(1);

      expect(result).toBeInstanceOf(CreateNoticeResponseDto);
      expect(result).toEqual({
        noticeId: `notice-${savedFirstMessage.id}`,
        content: dto.content,
        recipientCount: activeUsers.length,
        createdAt: expect.any(Date),
      });
    });

    it('should send 1:1 message successfully', async () => {
      const dto: CreateMessageDto = {
        receiverNickname: 'targetuser',
        content: 'Hello!',
      };

      const targetUser = createUserEntity({
        id: 2,
        nickname: 'targetuser',
        name: 'Target User',
        email: 'target@example.com',
        role: UserRole.USER,
      });

      jest
        .spyOn(usersService, 'findUserByNickname')
        .mockResolvedValue(targetUser);

      const createInput = {
        senderId: mockUser.id,
        receiverId: targetUser.id,
        content: dto.content,
        isNotice: false,
      };

      const createdMessage = createMessageEntity({
        ...createInput,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        sender: mockUser,
        receiver: targetUser,
      });
      jest.spyOn(messageRepository, 'create').mockReturnValue(createdMessage);

      jest
        .spyOn(messageRepository, 'save')
        .mockImplementation(async (message: Message) => {
          return message;
        });

      jest
        .spyOn(messageRepository, 'findOne')
        .mockResolvedValue(createdMessage);

      const result = await service.create(mockUser, dto);

      expect(usersService.findUserByNickname).toHaveBeenCalledWith(
        'targetuser',
      );
      expect(messageRepository.create).toHaveBeenCalled();
      expect(isMessageDetailDto(result)).toBe(true);

      if (isMessageDetailDto(result)) {
        expect(result.content).toBe('Hello!');
        expect(result.isNotice).toBe(false);
        expect(result.senderNickname).toBe(mockUser.nickname);
      }
    });

    it('should throw NotFoundException if receiver by nickname not found', async () => {
      const dto: CreateMessageDto = {
        receiverNickname: 'nonexistent',
        content: 'Hello!',
        isNotice: false,
      };

      jest.spyOn(usersService, 'findUserByNickname').mockResolvedValue(null);

      await expect(service.create(mockUser, dto)).rejects.toThrow(
        new NotFoundException(MessageErrors.RECEIVER_NOT_FOUND),
      );

      expect(usersService.findUserByNickname).toHaveBeenCalledWith(
        'nonexistent',
      );
    });

    it('should throw NotFoundException if receiver is deleted', async () => {
      const dto: CreateMessageDto = {
        receiverNickname: 'deleteduser',
        content: 'Hello!',
        isNotice: false,
      };

      const deletedUser = createUserEntity({
        id: 2,
        nickname: 'deleteduser',
        deletedAt: new Date(),
      });

      jest
        .spyOn(usersService, 'findUserByNickname')
        .mockResolvedValue(deletedUser);

      await expect(service.create(mockUser, dto)).rejects.toThrow(
        new NotFoundException(MessageErrors.RECEIVER_NOT_FOUND),
      );

      expect(usersService.findUserByNickname).toHaveBeenCalledWith(
        'deleteduser',
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if message not found', async () => {
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);
      await expect(service.findOne(999, mockUser)).rejects.toThrow(
        new NotFoundException(MessageErrors.MESSAGE_NOT_FOUND),
      );
    });

    it('should mark message as read on first view', async () => {
      const mockMessage = createMessageEntity({
        id: 1,
        sender: createUserEntity({ name: 'Alice', nickname: 'alice' }),
        content: 'Hello!',
        isRead: false,
        isNotice: false,
      });

      jest.spyOn(messageRepository, 'save').mockResolvedValue(mockMessage);
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(mockMessage);

      const result = await service.findOne(1, mockUser);

      expect(mockMessage.isRead).toBe(true);
      expect(messageRepository.save).toHaveBeenCalled();
      expect(result).toEqual(MessageDetailDto.fromEntity(mockMessage));
    });
  });

  describe('remove', () => {
    it('should soft delete message', async () => {
      const mockMessage = createMessageEntity({ id: 1 });
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(mockMessage);
      jest.spyOn(messageRepository, 'softDelete').mockResolvedValue({} as any);

      const result = await service.remove(1, mockUser);
      expect(messageRepository.softDelete).toHaveBeenCalledWith({ id: 1 });
      expect(result.message).toBe(MessageResponses.DELETED);
    });

    it('should throw NotFoundException if message not found', async () => {
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);
      await expect(service.remove(999, mockUser)).rejects.toThrow(
        new NotFoundException(MessageErrors.MESSAGE_NOT_FOUND),
      );
    });
  });
});
