import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
  MakeUserEntityFaker,
} from './faker/user.faker';
import { NotFoundException } from '@nestjs/common';

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
    const user = {
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash: createUserDto.password,
    };

    it('should create a new user successfully', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(null); // Mock findExistUser to return null (not found)
      jest.spyOn(repository, 'create').mockReturnValue(user as User);
      jest.spyOn(repository, 'save').mockResolvedValue(user as User);

      const result = await service.signUpUser(createUserDto);

      expect(result).toEqual(user);
      expect(repository.create).toHaveBeenCalledWith(user);
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('should throw an error if email already exists', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(user as User);

      await expect(service.signUpUser(createUserDto)).rejects.toThrow(
        `This email ${createUserDto.email} is already existed!`,
      );
    });
  });

  describe('findExistUser', () => {
    it('should return a user if found', async () => {
      const mockUser = MakeUserEntityFaker();
      const email = mockUser.email;

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.findExistUser(email);

      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email } });
    });

    it('should return null if no user is found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.findExistUser('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password successfully', async () => {
      const updateUserDto = MakeUpdateUserDtoFaker();
      const user = MakeUserEntityFaker();
      const email = user.email;

      jest.spyOn(service, 'findExistUser').mockResolvedValue(user);
      jest
        .spyOn(repository, 'save')
        .mockResolvedValue({ ...user, passwordHash: updateUserDto.password });

      const result = await service.updatePassword(email, updateUserDto);

      expect(result.passwordHash).toBe(updateUserDto.password);
      expect(repository.save).toHaveBeenCalledWith({
        ...user,
        passwordHash: updateUserDto.password,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(null);

      await expect(
        service.updatePassword('nonexistent@example.com', {
          password: 'newPassword',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAccount', () => {
    it('should remove user account successfully', async () => {
      const user = MakeUserEntityFaker();
      const email = user.email;

      jest.spyOn(service, 'findExistUser').mockResolvedValue(user);
      jest
        .spyOn(repository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.removeAccount(email);

      expect(result).toEqual({ affected: 1 });
      expect(repository.delete).toHaveBeenCalledWith({ email });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(service, 'findExistUser').mockResolvedValue(null);

      await expect(
        service.removeAccount('nonexistent@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
