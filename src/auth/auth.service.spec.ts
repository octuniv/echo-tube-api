import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MakeUserEntityFaker } from '@/users/faker/user.faker';

const mockUser = MakeUserEntityFaker();

describe('AuthService', () => {
  let authService: AuthService;
  // let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    findUser: jest.fn().mockResolvedValue(mockUser),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    // usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  it('should validate a user with correct credentials', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const result = await authService.validateUser(
      mockUser.email,
      mockUser.passwordHash,
    );
    expect(result).toEqual({
      email: mockUser.email,
      name: mockUser.name,
    });
  });

  it('should return null if credentials are invalid', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    const result = await authService.validateUser(
      mockUser.email,
      'wrongpassword',
    );
    expect(result).toBeNull();
  });

  it('should login a user and return a JWT token', async () => {
    const user = { id: 1, email: mockUser.email };
    const result = await authService.login(user);
    expect(result).toEqual({ access_token: 'mocked-jwt-token' });
    expect(jwtService.sign).toHaveBeenCalledWith({
      email: user.email,
      sub: user.id,
    });
  });
});
