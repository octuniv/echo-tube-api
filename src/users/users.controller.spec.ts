import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { MakeCreateUserDtoFaker } from './faker/user.faker';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';

describe('UsersController', () => {
  let usersController: UsersController;

  const mockUsersService = {
    signUpUser: jest.fn((dto: CreateUserDto) =>
      Promise.resolve({
        id: 1,
        ...dto,
        passwordHash: 'hashedPassword',
      }),
    ),
    findExistUser: jest.fn((email: string) =>
      Promise.resolve(email === 'exists@example.com' ? true : false),
    ),
    updateNickname: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(usersController).toBeDefined();
  });

  describe('Signup User', () => {
    it('should create a new user', async () => {
      const createUserDto = MakeCreateUserDtoFaker();
      const result = await usersController.signUpUser(createUserDto);
      expect(result).toEqual({
        email: createUserDto.email,
        message: 'Successfully created account',
      });
    });
  });

  describe('Find ExistUser', () => {
    it('should find an existing user', async () => {
      const result = await usersController.findExistUser('exists@example.com');
      expect(result).toEqual({ existed: true });
    });

    it('should return false if user not found', async () => {
      const result = await usersController.findExistUser(
        'notfound@example.com',
      );
      expect(result).toEqual({ existed: false });
    });
  });

  describe('Update nickname', () => {
    it('should update nickname when authorized', async () => {
      const updateDto: UpdateUserNicknameRequest = { nickname: 'new' };
      const req = { user: { id: 1 } };
      const result = await usersController.updateNickname(updateDto, req);
      expect(result).toEqual({ message: 'Nickname change successful.' });
    });

    it('should throw UnauthorizedException when update nickname from an unauthorized user', async () => {
      const updateDto: UpdateUserNicknameRequest = { nickname: 'wrong' };
      mockUsersService.updateNickname = jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException('This user could not be found.'),
        );
      const req = { user: { id: 11111 } };
      await expect(
        usersController.updateNickname(updateDto, req),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when update nickname from an unauthorized user', async () => {
      const updateDto: UpdateUserNicknameRequest = { nickname: 'duplicated' };
      mockUsersService.updateNickname = jest
        .fn()
        .mockRejectedValue(
          new BadRequestException(
            `This nickname ${updateDto.nickname} is already existed!`,
          ),
        );
      const req = { user: { id: 1 } };
      await expect(
        usersController.updateNickname(updateDto, req),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Update password', () => {
    it('should update password when authorized', async () => {
      const updateDto: UpdateUserPasswordRequest = { password: 'newpassword' };
      const req = { user: { id: 1 } };
      const result = await usersController.updatePassword(updateDto, req);
      expect(result).toEqual({ message: 'Passcode change successful.' });
    });

    it('should throw UnauthorizedException when updating password from an unauthorized user', async () => {
      const updateDto: UpdateUserPasswordRequest = { password: 'newpassword' };
      mockUsersService.updatePassword = jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException('This user could not be found.'),
        );
      const req = { user: { id: 11111 } };
      await expect(
        usersController.updatePassword(updateDto, req),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Delete account', () => {
    it('should delete account when authorized', async () => {
      const req = { user: { email: 'exists@example.com' } };
      const result = await usersController.deleteAccount(req);
      expect(result).toEqual({ message: 'Successfully deleted account' });
    });

    it('should throw UnauthorizedException when deleting another user account', async () => {
      const req = { user: { email: 'wrong@example.com' } };
      mockUsersService.deleteAccount = jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException('This user could not be found.'),
        );
      await expect(usersController.deleteAccount(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
