import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageService } from './message.service';
import { Message } from './entities/message.entity';
import { UsersService } from '@/users/users.service';
import { User } from '@/users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MessageErrorMessages } from './constants/message.constants';
import { createUserEntity } from '@/users/factory/user.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import { createMessageEntity } from './factory/create-message-entity';
import { MessageDetailDto } from './dto/message-response.dto';

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
            getUserById: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn(),
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
        receiverId: 2,
        content: 'Hi',
        isNotice: true,
      };
      await expect(service.create(mockUser, dto)).rejects.toThrow(
        new ForbiddenException(MessageErrorMessages.FORBIDDEN_NOTICE),
      );
    });

    it('should send notice to all users (except sender) if admin', async () => {
      const dto: CreateMessageDto = {
        receiverId: 2,
        content: 'System Notice',
        isNotice: true,
      };

      jest
        .spyOn(usersService, 'getAllActiveUsers')
        .mockResolvedValue([
          createUserEntity({ id: 2, name: 'User2' }),
          createUserEntity({ id: 3, name: 'User3' }),
        ]);

      jest.spyOn(messageRepository, 'create').mockImplementation((data) => {
        return createMessageEntity({
          ...data,
          sender: mockAdmin,
          receiver: createUserEntity({ id: data.receiverId }),
        });
      });

      const savedMessages = [
        createMessageEntity({
          senderId: mockAdmin.id,
          receiverId: 2,
          content: dto.content,
          isNotice: true,
          sender: mockAdmin,
          receiver: createUserEntity({ id: 2 }),
        }),
        createMessageEntity({
          senderId: mockAdmin.id,
          receiverId: 3,
          content: dto.content,
          isNotice: true,
          sender: mockAdmin,
          receiver: createUserEntity({ id: 3 }),
        }),
      ];

      jest
        .spyOn(messageRepository, 'save')
        .mockResolvedValue(Promise.resolve(savedMessages) as any);

      const result = await service.create(mockAdmin, dto);

      expect(usersService.getAllActiveUsers).toHaveBeenCalled();
      expect(messageRepository.create).toHaveBeenCalledTimes(2);
      expect(messageRepository.save).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Message);
      expect(result[0].content).toBe('System Notice');
      expect(result[0].isNotice).toBe(true);
    });

    it('should send 1:1 message successfully', async () => {
      const dto: CreateMessageDto = { receiverId: 2, content: 'Hello!' };

      jest
        .spyOn(usersService, 'getUserById')
        .mockResolvedValue(createUserEntity({ id: 2, name: 'Receiver' }));

      const newMessage = createMessageEntity({
        senderId: mockUser.id,
        receiverId: dto.receiverId,
        content: dto.content,
        isNotice: false,
        sender: mockUser,
        receiver: createUserEntity({ id: dto.receiverId }),
      });

      jest.spyOn(messageRepository, 'create').mockReturnValue(newMessage);

      jest
        .spyOn(messageRepository, 'save')
        .mockResolvedValue(Promise.resolve(newMessage) as any);

      const result = await service.create(mockUser, dto);

      expect(messageRepository.create).toHaveBeenCalledWith({
        senderId: mockUser.id,
        receiverId: dto.receiverId,
        content: dto.content,
        isNotice: false,
      });
      expect(messageRepository.save).toHaveBeenCalledWith(newMessage);

      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.content).toBe('Hello!');
        expect(result.isNotice).toBe(false);
      }
    });
  });

  describe('findAll', () => {
    it('should return list of messages for receiver', async () => {
      const mockMessages = [
        createMessageEntity({
          id: 1,
          sender: createUserEntity({ nickname: 'Alice' }),
          content: 'Hello world!',
          isRead: false,
          createdAt: new Date(),
          isNotice: false,
        }),
      ];

      jest.spyOn(messageRepository, 'find').mockResolvedValue(mockMessages);

      const result = await service.findAll(mockUser);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('senderName', 'Alice');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if message not found', async () => {
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);
      await expect(service.findOne(999, mockUser)).rejects.toThrow(
        new NotFoundException(MessageErrorMessages.MESSAGE_NOT_FOUND),
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
      expect(result.message).toBe('메시지가 삭제되었습니다.');
    });

    it('should throw NotFoundException if message not found', async () => {
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(null);
      await expect(service.remove(999, mockUser)).rejects.toThrow(
        new NotFoundException(MessageErrorMessages.MESSAGE_NOT_FOUND),
      );
    });
  });
});
