import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { User } from '@/users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { createUserEntity } from '@/users/factory/user.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { MessageListItemDto } from './dto/message-response.dto';

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
      const dto: CreateMessageDto = {
        receiverNickname: 'target',
        content: 'Hi',
      };
      await controller.create(dto, mockRequest);
      expect(service.create).toHaveBeenCalledWith(mockUser, dto);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with user, default page and limit', async () => {
      const mockPaginatedResponse: PaginatedResponseDto<MessageListItemDto> = {
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      };
      (service.findAll as jest.Mock).mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(mockRequest, 1, 10);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, 1, 10);
    });

    it('should call service.findAll with user, custom page and limit', async () => {
      const mockPaginatedResponse: PaginatedResponseDto<MessageListItemDto> = {
        data: [],
        currentPage: 2,
        totalItems: 50,
        totalPages: 5,
      };
      (service.findAll as jest.Mock).mockResolvedValue(mockPaginatedResponse);

      await controller.findAll(mockRequest, 2, 20);

      expect(service.findAll).toHaveBeenCalledWith(mockUser, 2, 20);
    });

    it('should return paginated response from service', async () => {
      const expectedResponse: PaginatedResponseDto<MessageListItemDto> = {
        data: [
          {
            id: 1,
            senderNickname: 'Alice',
            preview: 'Hello...',
            isRead: false,
            createdAt: new Date(),
          },
        ],
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
      };
      (service.findAll as jest.Mock).mockResolvedValue(expectedResponse);

      const result = await controller.findAll(mockRequest, 1, 10);

      expect(result).toEqual(expectedResponse);
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
