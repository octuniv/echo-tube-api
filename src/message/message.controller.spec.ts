// src/messages/message.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { User } from '@/users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { createUserEntity } from '@/users/factory/user.factory';
import { UserRole } from '@/users/entities/user-role.enum';

describe('MessageController', () => {
  let controller: MessageController;
  let service: MessageService;

  const mockUser: User = createUserEntity({
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

  const mockRequest = {
    user: mockUser,
  } as RequestWithUser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        {
          provide: MessageService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessageController>(MessageController);
    service = module.get<MessageService>(MessageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with user and dto', async () => {
      const dto: CreateMessageDto = { receiverId: 2, content: 'Hi' };
      await controller.create(dto, mockRequest);
      expect(service.create).toHaveBeenCalledWith(mockUser, dto);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with user', async () => {
      await controller.findAll(mockRequest);
      expect(service.findAll).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and user', async () => {
      await controller.findOne('1', mockRequest);
      expect(service.findOne).toHaveBeenCalledWith(1, mockUser);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and user', async () => {
      await controller.remove('1', mockRequest);
      expect(service.remove).toHaveBeenCalledWith(1, mockUser);
    });
  });
});
