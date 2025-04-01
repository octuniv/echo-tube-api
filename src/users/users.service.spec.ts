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
    const user = {
      name: name,
      nickname: nickname,
      email: email,
      passwordHash: hashedPassword,
    };

    it('should create a new user successfully', async () => {
      jest.spyOn(service, 'isUserExists').mockResolvedValue(false);
      jest.spyOn(service, 'isNicknameAvailable').mockResolvedValue(false);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      jest.spyOn(repository, 'create').mockReturnValue(user as User);
      jest.spyOn(repository, 'save').mockResolvedValue(user as User);

      const result = await service.createUser(userDtoForCreate);

      expect(result).toEqual(user);
      expect(repository.create).toHaveBeenCalledWith(user);
      expect(repository.save).toHaveBeenCalledWith(user);
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
      expect(result.nickname).toBe(newNickname);
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
      expect(result.passwordHash).toBe(hashedPassword);
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

      expect(result).toBeUndefined();
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
});
