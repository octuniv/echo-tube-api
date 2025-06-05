import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserPasswordRequest } from './dto/update-user-password.dto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createUserDto } from './factory/user.factory';
import { UpdateUserNicknameRequest } from './dto/update-user-nickname.dto';
import { CheckEmailRequest } from './dto/check-user-email.dto';
import { CheckNicknameRequest } from './dto/check-user-nickname.dto';
import { createMock } from '@golevelup/ts-jest';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: createMock<UsersService>(),
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(usersController).toBeDefined();
  });

  describe('Signup User', () => {
    it('should create a new user', async () => {
      const userDtoForCreate = createUserDto();
      jest.spyOn(usersService, 'createUser').mockResolvedValue({
        email: userDtoForCreate.email,
        message: 'Successfully created account',
      });
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
      jest.spyOn(usersService, 'isUserExists').mockResolvedValue(true);
      const result =
        await usersController.checkEmailAvailability(checkEmailRequest);
      expect(result).toEqual({ exists: true });
    });
  });

  describe('Check nickname duplication', () => {
    it('should check an existing user', async () => {
      const checkNicknameRequest = {
        nickname: 'exists',
      } satisfies CheckNicknameRequest;
      jest.spyOn(usersService, 'isNicknameAvailable').mockResolvedValue(true);
      const result =
        await usersController.checkNicknameAvailability(checkNicknameRequest);
      expect(result).toEqual({ exists: true });
    });
  });

  describe('Update nickname', () => {
    it('should update nickname when authorized', async () => {
      const updateDto: UpdateUserNicknameRequest = { nickname: 'new' };
      const req = { user: { id: 1 } };
      jest
        .spyOn(usersService, 'updateUserNickname')
        .mockResolvedValue({ message: 'Nickname change successful.' });
      const result = await usersController.updateNickname(updateDto, req);
      expect(result).toEqual({ message: 'Nickname change successful.' });
    });

    it('should throw UnauthorizedException when update nickname from an unauthorized user', async () => {
      const updateDto: UpdateUserNicknameRequest = { nickname: 'wrong' };
      jest
        .spyOn(usersService, 'updateUserNickname')
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
      jest
        .spyOn(usersService, 'updateUserNickname')
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
      jest
        .spyOn(usersService, 'updateUserPassword')
        .mockResolvedValue({ message: 'Passcode change successful.' });
      const result = await usersController.updatePassword(updateDto, req);
      expect(result).toEqual({ message: 'Passcode change successful.' });
    });

    it('should throw UnauthorizedException when updating password from an unauthorized user', async () => {
      const updateDto: UpdateUserPasswordRequest = { password: 'newpassword' };
      jest
        .spyOn(usersService, 'updateUserPassword')
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
      jest.spyOn(usersService, 'softDeleteUser').mockResolvedValue({
        message: 'Successfully deleted account',
        success: true,
      });
      const result = await usersController.deleteUser(req);
      expect(result).toEqual({
        message: 'Successfully deleted account',
        success: true,
      });
    });

    it('should throw UnauthorizedException when deleting another user account', async () => {
      const req = { user: { email: 'wrong@example.com' } };
      jest
        .spyOn(usersService, 'softDeleteUser')
        .mockRejectedValue(
          new UnauthorizedException('This user could not be found.'),
        );
      await expect(usersController.deleteUser(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
