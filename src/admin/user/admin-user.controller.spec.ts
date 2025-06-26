import { Test, TestingModule } from '@nestjs/testing';
import { AdminUserController } from './admin-user.controller';
import { UsersService } from '@/users/users.service';
import { AdminCreateUserDto } from '@/users/dto/admin/admin-create-user-dto';
import { AdminUpdateUserDto } from '@/users/dto/admin/admin-update-user-dto';
import { AdminUserDetailResponseDto } from '@/users/dto/admin/admin-user-detail-response.dto';
import { AdminUserListResponseDto } from '@/users/dto/admin/admin-user-list-response.dto';
import { AdminUserUpdateResponseDto } from '@/users/dto/admin/admin-user-update-response.dto';
import { UserDeleteResponseDto } from '@/users/dto/user-delete-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { createMock } from '@golevelup/ts-jest';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserResponseDto } from '@/users/dto/user-create-response.dto';
import { createUserEntity } from '@/users/factory/user.factory';
import { SearchUserDto } from './dto/search-user.dto';

describe('AdminUserController', () => {
  let adminUserController: AdminUserController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [
        {
          provide: UsersService,
          useValue: createMock<UsersService>(),
        },
      ],
    }).compile();

    adminUserController = module.get<AdminUserController>(AdminUserController);
    usersService = module.get<UsersService>(UsersService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(adminUserController).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const dto: AdminCreateUserDto = {
        name: 'Test User',
        nickname: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: UserRole.USER,
      };

      const mockResponse: CreateUserResponseDto = {
        email: dto.email,
        message: 'Successfully created account',
      };

      jest.spyOn(usersService, 'createUser').mockResolvedValue(mockResponse);

      const result = await adminUserController.createUser(dto);
      expect(result).toEqual(mockResponse);
      expect(usersService.createUser).toHaveBeenCalledWith(dto);
    });

    it('should throw ConflictException when email exists', async () => {
      const dto: AdminCreateUserDto = {
        name: 'Test User',
        nickname: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: UserRole.USER,
      };

      jest
        .spyOn(usersService, 'createUser')
        .mockRejectedValue(
          new ConflictException(`This email ${dto.email} is already existed!`),
        );

      await expect(adminUserController.createUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when nickname exists', async () => {
      const dto: AdminCreateUserDto = {
        name: 'Test User',
        nickname: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: UserRole.USER,
      };

      jest
        .spyOn(usersService, 'createUser')
        .mockRejectedValue(
          new ConflictException(
            `This nickname ${dto.nickname} is already existed!`,
          ),
        );

      await expect(adminUserController.createUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('listUsers', () => {
    it('should return paginated user list', async () => {
      const paginationDto: PaginationDto = { page: 1, limit: 10 };
      const mockUsers: AdminUserListResponseDto[] = [
        createUserEntity({ id: 1 }),
      ];

      const mockResponse: PaginatedResponseDto<AdminUserListResponseDto> = {
        data: mockUsers,
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
      };

      jest
        .spyOn(usersService, 'findAllWithPagination')
        .mockResolvedValue(mockResponse);

      const result = await adminUserController.listUsers(paginationDto);
      expect(result).toEqual(mockResponse);
      expect(usersService.findAllWithPagination).toHaveBeenCalledWith(
        1,
        10,
        'createdAt',
        'DESC',
      );
    });

    it('should use default pagination values when not provided', async () => {
      const mockResponse: PaginatedResponseDto<AdminUserListResponseDto> = {
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      };

      jest
        .spyOn(usersService, 'findAllWithPagination')
        .mockResolvedValue(mockResponse);

      const result = await adminUserController.listUsers({});
      expect(result).toEqual(mockResponse);
      expect(usersService.findAllWithPagination).toHaveBeenCalledWith(
        1,
        10,
        'createdAt',
        'DESC',
      );
    });
  });

  describe('getUserDetails', () => {
    it('should return user details', async () => {
      const userId = 1;
      const mockUser: AdminUserDetailResponseDto = createUserEntity({ id: 1 });

      jest.spyOn(usersService, 'getAdminUserById').mockResolvedValue(mockUser);

      const result = await adminUserController.getUserDetails(userId);
      expect(result).toEqual(mockUser);
      expect(usersService.getAdminUserById).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 999;

      jest
        .spyOn(usersService, 'getAdminUserById')
        .mockRejectedValue(
          new NotFoundException(`User with ID ${userId} not found`),
        );

      await expect(adminUserController.getUserDetails(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = 1;
      const dto: AdminUpdateUserDto = {
        name: 'Updated Name',
        nickname: 'updateduser',
        role: UserRole.ADMIN,
      };

      const mockResponse: AdminUserUpdateResponseDto = {
        message: 'Successfully updated user',
        success: true,
      };

      jest.spyOn(usersService, 'updateUser').mockResolvedValue(mockResponse);

      const result = await adminUserController.updateUser(userId, dto);
      expect(result).toEqual(mockResponse);
      expect(usersService.updateUser).toHaveBeenCalledWith(1, dto);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 999;
      const dto: AdminUpdateUserDto = {
        name: 'Updated Name',
      };

      jest
        .spyOn(usersService, 'updateUser')
        .mockRejectedValue(
          new NotFoundException(`User with ID ${userId} not found`),
        );

      await expect(adminUserController.updateUser(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when nickname is taken', async () => {
      const userId = 1;
      const dto: AdminUpdateUserDto = {
        nickname: 'taken',
      };

      jest
        .spyOn(usersService, 'updateUser')
        .mockRejectedValue(
          new ConflictException(`Nickname ${dto.nickname} is already taken`),
        );

      await expect(adminUserController.updateUser(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const userId = 1;

      const mockResponse: UserDeleteResponseDto = {
        message: 'Successfully deleted user',
        success: true,
      };

      jest
        .spyOn(usersService, 'softDeleteUser')
        .mockResolvedValue(mockResponse);

      const result = await adminUserController.deleteUser(userId);
      expect(result).toEqual(mockResponse);
      expect(usersService.softDeleteUser).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 999;

      jest
        .spyOn(usersService, 'softDeleteUser')
        .mockRejectedValue(
          new NotFoundException(`This user could not be found.`),
        );

      await expect(adminUserController.deleteUser(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on deletion failure', async () => {
      const userId = 1;

      jest
        .spyOn(usersService, 'softDeleteUser')
        .mockRejectedValue(
          new InternalServerErrorException('Internal Server Error'),
        );

      await expect(adminUserController.deleteUser(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('searchUsers', () => {
    it('should return filtered and paginated user list', async () => {
      const searchDto: SearchUserDto = {
        page: 1,
        limit: 10,
        searchEmail: 'john',
        searchRole: UserRole.USER,
        sort: 'createdAt',
        order: 'DESC',
      };
      const mockUsers: AdminUserListResponseDto[] = [
        createUserEntity({ id: 1, email: 'john.doe@example.com' }),
      ];
      const mockResponse: PaginatedResponseDto<AdminUserListResponseDto> = {
        data: mockUsers,
        currentPage: 1,
        totalItems: 1,
        totalPages: 1,
      };

      jest
        .spyOn(usersService, 'findUsersWithSearch')
        .mockResolvedValue(mockResponse);

      const result = await adminUserController.searchUsers(searchDto);
      expect(result).toEqual(mockResponse);
      expect(usersService.findUsersWithSearch).toHaveBeenCalledWith(
        1,
        10,
        { email: 'john', role: UserRole.USER },
        'createdAt',
        'DESC',
      );
    });

    it('should use default values when no search params provided', async () => {
      const searchDto: SearchUserDto = {};
      const mockResponse: PaginatedResponseDto<AdminUserListResponseDto> = {
        data: [],
        currentPage: 1,
        totalItems: 0,
        totalPages: 0,
      };

      jest
        .spyOn(usersService, 'findUsersWithSearch')
        .mockResolvedValue(mockResponse);

      const result = await adminUserController.searchUsers(searchDto);
      expect(result).toEqual(mockResponse);
      expect(usersService.findUsersWithSearch).toHaveBeenCalledWith(
        1,
        10,
        {},
        'createdAt',
        'DESC',
      );
    });
  });
});
