import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { createUserDto } from './factory/user.factory';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';
import { CheckEmailRequest } from './dto/check-user-email.dto';
import { CheckNicknameRequest } from './dto/check-user-nickname.dto';

describe('UsersController', () => {
  let usersController: UsersController;

  const mockUsersService = {
    createUser: jest.fn((dto: CreateUserDto) =>
      Promise.resolve({
        id: 1,
        ...dto,
        passwordHash: 'hashedPassword',
      }),
    ),
    isUserExists: jest.fn((email: string) =>
      Promise.resolve(email === 'exists@example.com' ? true : false),
    ),
    updateUserNickname: jest.fn().mockResolvedValue(undefined),
    updateUserPassword: jest.fn().mockResolvedValue(undefined),
    softDeleteUser: jest.fn().mockResolvedValue(undefined),
    isNicknameAvailable: jest.fn((nickname: string) =>
      Promise.resolve(nickname === 'exists' ? true : false),
    ),
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
      const userDtoForCreate = createUserDto();
      const result = await usersController.createUser(userDtoForCreate);
      expect(result).toEqual({
        email: userDtoForCreate.email,
        message: 'Successfully created account',
      });
    });
  });

  describe('Check email duplication', () => {
    it('should check an existing user', async () => {
      const checkEmailRequest = {
        email: 'exists@example.com',
      } satisfies CheckEmailRequest;
      const result =
        await usersController.checkEmailAvailability(checkEmailRequest);
      expect(result).toEqual({ exists: true });
    });

    it('should return false if user not found', async () => {
      const checkEmailRequest = {
        email: 'notfound@example.com',
      } satisfies CheckEmailRequest;
      const result =
        await usersController.checkEmailAvailability(checkEmailRequest);
      expect(result).toEqual({ exists: false });
    });
  });

  describe('Check nickname duplication', () => {
    it('should check an existing user', async () => {
      const checkNicknameRequest = {
        nickname: 'exists',
      } satisfies CheckNicknameRequest;
      const result =
        await usersController.checkNicknameAvailability(checkNicknameRequest);
      expect(result).toEqual({ exists: true });
    });

    it('should check an existing user', async () => {
      const checkNicknameRequest = {
        nickname: 'nonExists',
      } satisfies CheckNicknameRequest;
      const result =
        await usersController.checkNicknameAvailability(checkNicknameRequest);
      expect(result).toEqual({ exists: false });
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
      mockUsersService.updateUserNickname = jest
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
      mockUsersService.updateUserNickname = jest
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
      mockUsersService.updateUserPassword = jest
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
      const result = await usersController.deleteUser(req);
      expect(result).toEqual({ message: 'Successfully deleted account' });
    });

    it('should throw UnauthorizedException when deleting another user account', async () => {
      const req = { user: { email: 'wrong@example.com' } };
      mockUsersService.softDeleteUser = jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException('This user could not be found.'),
        );
      await expect(usersController.deleteUser(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
