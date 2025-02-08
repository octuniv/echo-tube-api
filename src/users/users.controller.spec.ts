import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { MakeCreateUserDtoFaker } from './faker/user.faker';

describe('UsersController', () => {
  let usersController: UsersController;
  // let usersService: UsersService;

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
    updatePassword: jest.fn().mockResolvedValue(undefined),
    removeAccount: jest.fn().mockResolvedValue(undefined),
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
    // usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(usersController).toBeDefined();
  });

  it('should create a new user', async () => {
    const createUserDto = MakeCreateUserDtoFaker();
    const result = await usersController.signUpUser(createUserDto);
    expect(result).toEqual({
      email: createUserDto.email,
      message: 'Successfully created account',
    });
  });

  it('should find an existing user', async () => {
    const result = await usersController.findExistUser('exists@example.com');
    expect(result).toBeTruthy();
  });

  it('should return false if user not found', async () => {
    const result = await usersController.findExistUser('notfound@example.com');
    expect(result).toBeFalsy();
  });

  it('should update password when authorized', async () => {
    const updateDto: UpdateUserDto = { password: 'newpassword' };
    const req = { user: { email: 'exists@example.com' } };
    const result = await usersController.updatePassword(
      'exists@example.com',
      updateDto,
      req,
    );
    expect(result).toEqual({ message: 'Passcode change successful.' });
  });

  it('should throw UnauthorizedException when updating another user', async () => {
    const updateDto: UpdateUserDto = { password: 'newpassword' };
    const req = { user: { email: 'wrong@example.com' } };
    await expect(
      usersController.updatePassword('exists@example.com', updateDto, req),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should delete account when authorized', async () => {
    const req = { user: { email: 'exists@example.com' } };
    const result = await usersController.removeAccount(
      'exists@example.com',
      req,
    );
    expect(result).toEqual({ message: 'Successfully deleted account' });
  });

  it('should throw UnauthorizedException when deleting another user account', async () => {
    const req = { user: { email: 'wrong@example.com' } };
    await expect(
      usersController.removeAccount('exists@example.com', req),
    ).rejects.toThrow(UnauthorizedException);
  });
});
