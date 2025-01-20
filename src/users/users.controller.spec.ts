import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
  MakeUserEntityFaker,
} from './faker/user.faker';
import { NotFoundException } from '@nestjs/common';

const mockUser = MakeUserEntityFaker();
const createUserDto = MakeCreateUserDtoFaker();
const updateUserDto = MakeUpdateUserDtoFaker();

const MockUsersService = () => ({
  signUpUser: jest.fn().mockResolvedValue(mockUser),
  findExistUser: jest.fn().mockResolvedValue(mockUser),
  updatePassword: jest
    .fn()
    .mockResolvedValue({ ...mockUser, passwordHash: updateUserDto.password }),
  removeAccount: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: MockUsersService(),
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersController).toBeDefined();
  });

  describe('signUpUser', () => {
    it('should create a new user', async () => {
      const result = await usersController.signUpUser(createUserDto);
      expect(result).toEqual(mockUser);
      expect(usersService.signUpUser).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('findExistUser', () => {
    it('should return a user by email', async () => {
      const result = await usersController.findExistUser('test@example.com');
      expect(result).toEqual(mockUser);
      expect(usersService.findExistUser).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should throw NotFoundException if user is not found', async () => {
      jest.spyOn(usersService, 'findExistUser').mockResolvedValue(null);
      await expect(
        usersController.findExistUser('notfound@example.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePassword', () => {
    it('should update the user password', async () => {
      const result = await usersController.updatePassword(
        'test@example.com',
        updateUserDto,
      );
      expect(result.passwordHash).toEqual(updateUserDto.password);
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'test@example.com',
        updateUserDto,
      );
    });
  });

  describe('removeAccount', () => {
    it('should delete the user account', async () => {
      const result = await usersController.removeAccount('test@example.com');
      expect(result.affected).toBe(1);
      expect(usersService.removeAccount).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should handle failed deletion', async () => {
      jest
        .spyOn(usersService, 'removeAccount')
        .mockResolvedValue({ raw: [], affected: 0 });
      const result = await usersController.removeAccount(
        'notfound@example.com',
      );
      expect(result.affected).toBe(0);
    });
  });
});
