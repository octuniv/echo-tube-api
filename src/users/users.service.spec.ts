import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  createUserDto,
  updateUserNicknameDto,
  updateUserPasswordDto,
  createUserEntity,
} from './factory/user.factory';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';
import { AdminCreateUserDto } from './dto/admin/admin-create-user-dto';
import { UserRole } from './entities/user-role.enum';
import { AdminUpdateUserDto } from './dto/admin/admin-update-user-dto';
import { CreateUserResponseDto } from './dto/user-create-response.dto';
import { UserDeleteResponseDto } from './dto/user-delete-response.dto';
import { plainToInstance } from 'class-transformer';
import { AdminUserDetailResponseDto } from './dto/admin/admin-user-detail-response.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository, // Mock TypeORM repository
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks(); // Reset all mocks after each test
  });

  describe('signUpUser', () => {
    const userDtoForCreate = createUserDto();
    const { name, email, nickname, password } = userDtoForCreate;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = createUserEntity({
      name: name,
      nickname: nickname,
      email: email,
      passwordHash: hashedPassword,
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a new user successfully', async () => {
      jest.spyOn(service, 'isUserExists').mockResolvedValue(false);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(false);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      jest.spyOn(repository, 'create').mockReturnValue({
        ...user,
        role: UserRole.USER,
      } as User);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...user,
        role: UserRole.USER,
      } as User);

      const result = await service.createUser(userDtoForCreate);

      expect(result).toEqual({
        userId: user.id,
        email: user.email,
        message: 'Successfully created account',
      } satisfies CreateUserResponseDto);
      expect(repository.create).toHaveBeenCalledWith({
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        passwordHash: user.passwordHash,
        role: UserRole.USER,
      });
      expect(repository.save).toHaveBeenCalledWith({
        ...user,
        role: UserRole.USER,
      });
    });

    it('should throw an error if email already exists', async () => {
      jest.spyOn(service, 'isUserExists').mockResolvedValue(true);

      await expect(service.createUser(userDtoForCreate)).rejects.toThrow(
        new ConflictException(`This email ${email} is already existed!`),
      );
    });

    it('should throw an error if nickname already exists', async () => {
      jest.spyOn(service, 'isUserExists').mockResolvedValue(false);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(true);

      await expect(service.createUser(userDtoForCreate)).rejects.toThrow(
        new ConflictException(`This nickname ${nickname} is already existed!`),
      );
    });

    it('should create admin user with role', async () => {
      const dto: AdminCreateUserDto = {
        name: 'Admin User',
        nickname: 'admin_user',
        email: 'admin@example.com',
        password: password,
        role: UserRole.ADMIN,
      };

      const user = createUserEntity({
        name: dto.name,
        nickname: dto.nickname,
        email: dto.email,
        passwordHash: hashedPassword,
        role: UserRole.USER,
      });
      jest.spyOn(service, 'isUserExists').mockResolvedValue(false);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(false);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      jest.spyOn(repository, 'create').mockReturnValue(user as User);
      jest.spyOn(repository, 'save').mockResolvedValue(user as User);

      const result = await service.createUser(dto);
      expect(result).toEqual({
        userId: user.id,
        email: user.email,
        message: 'Successfully created account',
      } satisfies CreateUserResponseDto);
    });
  });

  describe('getUserById', () => {
    it('should return a user if found', async () => {
      const mockUser = createUserEntity();

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.getUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        withDeleted: true,
      });
    });

    it('should return null if no user is found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getUserById(999)).resolves.toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user if found', async () => {
      const mockUser = createUserEntity();
      const email = mockUser.email;

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.getUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should throw NotFoundException Error if no user is found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.getUserByEmail('nonexistent@example.com'),
      ).rejects.toThrow(
        new NotFoundException(
          'This email nonexistent@example.com user could not be found',
        ),
      );
    });
  });

  describe('isUserExists', () => {
    it('should return true if user exists', async () => {
      const mockUser = createUserEntity();
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.isUserExists(mockUser.email);

      expect(result).toBeTruthy();
    });

    it('should return false if user does not exist', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.isUserExists('nonexistent@example.com');

      expect(result).toBeFalsy();
    });
  });

  describe('updateNickname', () => {
    it('should update user nickname successfully', async () => {
      const UpdateUserNicknameRequest = updateUserNicknameDto();

      const user = createUserEntity();
      const newNickname = UpdateUserNicknameRequest.nickname;

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(false);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...user,
        nickname: newNickname,
      });

      const result = await service.updateUserNickname(
        user.id,
        UpdateUserNicknameRequest,
      );
      expect(result).toEqual({ message: 'Nickname change successful.' });
      expect(repository.save).toHaveBeenCalledWith({
        ...user,
        nickname: newNickname,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(
        service.updateUserNickname(1111, {
          nickname: 'newNickname',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if nickname is already existed.', async () => {
      const user = createUserEntity();

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(true);

      await expect(
        service.updateUserNickname(1, {
          nickname: 'duplicatedNickname',
        } satisfies UpdateUserNicknameRequest),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      const UpdateUserPasswordRequest = updateUserPasswordDto();
      const hashedPassword = await bcrypt.hash(
        UpdateUserPasswordRequest.password,
        10,
      );
      const user = createUserEntity();

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);
      jest
        .spyOn(repository, 'save')
        .mockResolvedValue({ ...user, passwordHash: hashedPassword });

      const result = await service.updateUserPassword(
        user.id,
        UpdateUserPasswordRequest,
      );
      expect(result).toEqual({
        message: 'Passcode change successful.',
      });
      expect(repository.save).toHaveBeenCalledWith({
        ...user,
        passwordHash: hashedPassword,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(
        service.updateUserPassword(1111, {
          password: 'newPassword',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('should remove user account successfully', async () => {
      const mockUser = createUserEntity();

      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        raw: [],
        affected: 1,
        generatedMaps: [],
      });

      const result = await service.softDeleteUser(mockUser.id);

      expect(result).toEqual({
        message: 'Successfully deleted account',
        success: true,
      } satisfies UserDeleteResponseDto);
      expect(service.getUserById).toHaveBeenCalledWith(mockUser.id);
      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.softDeleteUser(11111)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException when deleting user occurs error.', async () => {
      const mockUser = createUserEntity();

      jest.spyOn(service, 'getUserById').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        raw: [],
        affected: 0,
        generatedMaps: [],
      });

      expect(service.softDeleteUser(mockUser.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('updateUser (by Admin)', () => {
    it('should success to change role', async () => {
      const mockUser = createUserEntity();
      const mockDto = {
        role: UserRole.ADMIN,
      } satisfies AdminUpdateUserDto;

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockUser);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(false);
      jest
        .spyOn(repository, 'save')
        .mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });

      const result = await service.updateUser(mockUser.id, mockDto);
      expect(result).toEqual({
        message: 'Successfully updated user',
        success: true,
      });
      expect(repository.save).toHaveBeenCalledWith({
        ...mockUser,
        role: UserRole.ADMIN,
      });
    });

    it('should throw error to change duplicated nickname', async () => {
      const mockUser = createUserEntity();
      const mockDto = {
        nickname: 'duplicated',
      } satisfies AdminUpdateUserDto;

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockUser);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(true);

      await expect(service.updateUser(mockUser.id, mockDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllWithPagination', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return paginated users with default pagination', async () => {
      const mockUsers = Array.from({ length: 10 }, (_, i) =>
        createUserEntity({ id: i + 1 }),
      );
      const totalItems = mockUsers.length;

      jest
        .spyOn(repository, 'findAndCount')
        .mockResolvedValue([mockUsers, totalItems]);

      const result = await service.findAllWithPagination();

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        withDeleted: true,
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });

      expect(result.data).toHaveLength(mockUsers.length);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(totalItems);
      expect(result.totalPages).toBe(Math.ceil(totalItems / 10));
    });

    it('should return paginated users with page=2, limit=5', async () => {
      const mockUsers = Array.from({ length: 5 }, (_, i) =>
        createUserEntity({ id: i + 6 }),
      );
      const totalItems = 25;
      const page = 2;
      const limit = 5;
      const skip = (page - 1) * limit;

      jest
        .spyOn(repository, 'findAndCount')
        .mockResolvedValue([mockUsers, totalItems]);

      const result = await service.findAllWithPagination(page, limit);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        withDeleted: true,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      });

      expect(result.data).toHaveLength(mockUsers.length);
      expect(result.currentPage).toBe(page);
      expect(result.totalItems).toBe(totalItems);
      expect(result.totalPages).toBe(Math.ceil(totalItems / limit));
    });

    it('should return empty data when no users exist', async () => {
      jest.spyOn(repository, 'findAndCount').mockResolvedValue([[], 0]);

      const result = await service.findAllWithPagination(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.currentPage).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should transform entities to AdminUserDetailResponseDto', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        nickname: 'john123',
        email: 'john@example.com',
        role: UserRole.USER,
        createdAt: new Date(),
        deletedAt: null,
      } as User;

      jest.spyOn(repository, 'findAndCount').mockResolvedValue([[mockUser], 1]);

      const result = await service.findAllWithPagination();

      const expectedDto = plainToInstance(AdminUserDetailResponseDto, mockUser);

      expect(result.data[0]).toEqual(expectedDto);
    });

    it('should include soft-deleted users when withDeleted: true', async () => {
      const mockUsers = [
        { id: 1, deletedAt: new Date() },
        { id: 2, deletedAt: null },
      ] as User[];
      jest.spyOn(repository, 'findAndCount').mockResolvedValue([mockUsers, 2]);

      const result = await service.findAllWithPagination(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].deletedAt).toEqual(mockUsers[0].deletedAt);
      expect(result.data[1].deletedAt).toEqual(mockUsers[1].deletedAt);
    });

    it('should sort by createdAt DESC when specified', async () => {
      const mockUsers = Array.from({ length: 10 }, (_, i) =>
        createUserEntity({ id: i + 1, createdAt: new Date(2023 - i, 0, 1) }),
      );

      jest.spyOn(repository, 'findAndCount').mockResolvedValue([mockUsers, 10]);

      const result = await service.findAllWithPagination(
        1,
        10,
        'createdAt',
        'DESC',
      );

      const sorted = [...mockUsers].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      expect(result.data.map((d) => d.id)).toEqual(sorted.map((u) => u.id));
    });

    it('should default to createdAt DESC if no sort/order provided', async () => {
      const mockUsers = Array.from({ length: 10 }, (_, i) =>
        createUserEntity({ id: i + 1, createdAt: new Date(2023 - i, 0, 1) }),
      );

      jest.spyOn(repository, 'findAndCount').mockResolvedValue([mockUsers, 10]);

      const result = await service.findAllWithPagination();

      // 기본값: createdAt DESC
      const sorted = [...mockUsers].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      expect(result.data.map((d) => d.id)).toEqual(sorted.map((u) => u.id));
    });

    it('should sort by updatedAt DESC when specified', async () => {
      const mockUsers = Array.from({ length: 3 }, (_, i) =>
        createUserEntity({
          id: i + 1,
          updatedAt: new Date(2023 - i, 0, 1), // 시간 차이 생성
        }),
      );

      jest.spyOn(repository, 'findAndCount').mockResolvedValue([mockUsers, 3]);

      const result = await service.findAllWithPagination(
        1,
        10,
        'updatedAt',
        'DESC',
      );

      const sorted = [...mockUsers].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
      expect(result.data.map((d) => d.id)).toEqual(sorted.map((u) => u.id));
    });
  });

  describe('findUsersWithSearch', () => {
    it('should apply email filter and sort by createdAt DESC', async () => {
      const mockUser = createUserEntity({
        id: 1,
        email: 'john.doe@example.com',
      });
      const filters = { email: 'john' };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      } as any);

      const result = await service.findUsersWithSearch(
        1,
        10,
        filters,
        'createdAt',
        'DESC',
      );

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });

    it('should apply nickname filter and sort by updatedAt ASC', async () => {
      const mockUser = createUserEntity({ id: 1, nickname: 'johndoe123' });
      const filters = { nickname: 'johndoe' };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      } as any);

      const result = await service.findUsersWithSearch(
        1,
        10,
        filters,
        'updatedAt',
        'ASC',
      );

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.totalItems).toBe(1);
    });

    it('should include soft-deleted users', async () => {
      const mockUser = createUserEntity({ id: 1, deletedAt: new Date() });

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
      } as any);

      const result = await service.findUsersWithSearch(1, 10, {});

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(result.data[0].deletedAt).toEqual(mockUser.deletedAt);
    });
  });
});
