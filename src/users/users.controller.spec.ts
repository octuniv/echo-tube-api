import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  MakeCreateUserDtoFaker,
  MakeUpdateUserDtoFaker,
} from './faker/user.faker';

const createUserDto = MakeCreateUserDtoFaker();
const updateUserDto = MakeUpdateUserDtoFaker();

const MockUsersService = {
  signUpUser: jest.fn(),
  findExistUser: jest.fn(),
  updatePassword: jest.fn(),
  removeAccount: jest.fn(),
};

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: MockUsersService,
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should call signUpUser method', async () => {
    await usersController.signUpUser(createUserDto);
    expect(usersService.signUpUser).toHaveBeenCalledWith(createUserDto);
  });

  it('should return email exists message if user exists', async () => {
    const email = 'test@example.com';
    MockUsersService.findExistUser.mockResolvedValue(true);
    await expect(usersController.findExistUser(email)).resolves.toEqual(
      `${email} is already existed!`,
    );
    expect(usersService.findExistUser).toHaveBeenCalledWith(email);
  });

  it('should return email not exists message if user does not exist', async () => {
    const email = 'notfound@example.com';
    MockUsersService.findExistUser.mockResolvedValue(false);
    await expect(usersController.findExistUser(email)).resolves.toEqual(
      `${email} does not exist.`,
    );
    expect(usersService.findExistUser).toHaveBeenCalledWith(email);
  });

  it('should call updatePassword method', async () => {
    const email = 'test@example.com';
    await usersController.updatePassword(email, updateUserDto);
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      email,
      updateUserDto,
    );
  });

  it('should call removeAccount method', async () => {
    const email = 'test@example.com';
    await usersController.removeAccount(email);
    expect(usersService.removeAccount).toHaveBeenCalledWith(email);
  });
});
