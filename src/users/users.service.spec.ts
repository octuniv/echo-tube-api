import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserNicknameRequestFaker,
  MakeUpdateUserPasswordRequestFaker,
  MakeUserEntityFaker,
} from './faker/user.faker';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
    const createUserDto = MakeCreateUserDtoFaker();
    const { name, email, nickname, password } = createUserDto;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = {
      name: name,
      nickname: nickname,
      email: email,
      passwordHash: hashedPassword,
    };

    it('should create a new user successfully', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(false);
      jest.spyOn(service, 'findAbsenseOfNickname').mockResolvedValue(false);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      jest.spyOn(repository, 'create').mockReturnValue(user as User);
      jest.spyOn(repository, 'save').mockResolvedValue(user as User);

      const result = await service.signUpUser(createUserDto);

      expect(result).toEqual(user);
      expect(repository.create).toHaveBeenCalledWith(user);
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should throw an error if email already exists', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(true);

      await expect(service.signUpUser(createUserDto)).rejects.toThrow(
        new ConflictException(`This email ${email} is already existed!`),
      );
    });

    it('should throw an error if nickname already exists', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(false);
      jest.spyOn(service, 'findAbsenseOfNickname').mockResolvedValue(true);

      await expect(service.signUpUser(createUserDto)).rejects.toThrow(
        new ConflictException(`This nickname ${nickname} is already existed!`),
      );
    });
  });

  describe('findUserById', () => {
    it('should return a user if found', async () => {
      const mockUser = MakeUserEntityFaker();

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.findUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should return null if no user is found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findUserById(999)).resolves.toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user if found', async () => {
      const mockUser = MakeUserEntityFaker();
      const email = mockUser.email;

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.findUserByEmail(email);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email } });
    });

    it('should throw NotFoundException Error if no user is found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.findUserByEmail('nonexistent@example.com'),
      ).rejects.toThrow(
        new NotFoundException(
          'This email nonexistent@example.com user could not be found',
        ),
      );
    });
  });

  describe('findExistUser', () => {
    it('should return true if user exists', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockResolvedValue({ email: 'test@example.com' } as User);

      const result = await service.findExistUser('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockRejectedValue(new NotFoundException());

      const result = await service.findExistUser('nonexistent@example.com');

      expect(result).toBe(false);
    });

    it('should throw error if an unexpected error occurs', async () => {
      jest
        .spyOn(service, 'findUserByEmail')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.findExistUser('error@example.com')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('updateNickname', () => {
    it('should update user nickname successfully', async () => {
      const UpdateUserNicknameRequest = MakeUpdateUserNicknameRequestFaker();

      const user = MakeUserEntityFaker();
      const newNickname = UpdateUserNicknameRequest.nickname;

      jest.spyOn(service, 'findUserById').mockResolvedValue(user);
      jest.spyOn(service, 'findAbsenseOfNickname').mockResolvedValue(false);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...user,
        nickname: newNickname,
      });

      const result = await service.updateNickname(
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
      jest.spyOn(service, 'findUserById').mockResolvedValue(null);

      await expect(
        service.updateNickname(1111, {
          nickname: 'newNickname',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if nickname is already existed.', async () => {
      const user = MakeUserEntityFaker();

      jest.spyOn(service, 'findUserById').mockResolvedValue(user);
      jest.spyOn(service, 'findAbsenseOfNickname').mockResolvedValue(true);

      await expect(
        service.updateNickname(1, {
          nickname: 'duplicatedNickname',
        } satisfies UpdateUserNicknameRequest),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      const UpdateUserPasswordRequest = MakeUpdateUserPasswordRequestFaker();
      const hashedPassword = await bcrypt.hash(
        UpdateUserPasswordRequest.password,
        10,
      );
      const user = MakeUserEntityFaker();

      jest.spyOn(service, 'findUserById').mockResolvedValue(user);
      jest
        .spyOn(repository, 'save')
        .mockResolvedValue({ ...user, passwordHash: hashedPassword });

      const result = await service.updatePassword(
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
      jest.spyOn(service, 'findUserById').mockResolvedValue(null);

      await expect(
        service.updatePassword(1111, {
          password: 'newPassword',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('should remove user account successfully', async () => {
      const mockUser = MakeUserEntityFaker();

      jest.spyOn(service, 'findUserById').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        raw: [],
        affected: 1,
        generatedMaps: [],
      });

      const result = await service.deleteAccount(mockUser.id);

      expect(result).toBeUndefined();
      expect(service.findUserById).toHaveBeenCalledWith(mockUser.id);
      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(service, 'findUserById').mockResolvedValue(null);

      await expect(service.deleteAccount(11111)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException when deleting user occurs error.', async () => {
      const mockUser = MakeUserEntityFaker();

      jest.spyOn(service, 'findUserById').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        raw: [],
        affected: 0,
        generatedMaps: [],
      });

      expect(service.deleteAccount(mockUser.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
