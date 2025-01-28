import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MakeUserEntityFaker } from '@/users/faker/user.faker';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUsersService = {
    findUser: jest.fn(),
    findExistUser: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ConfigService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const mockUser = MakeUserEntityFaker();
      const password = 'password123';
      mockUser.passwordHash = await bcrypt.hash(password, 10);

      mockUsersService.findUser.mockResolvedValue(mockUser);

      const result = await authService.validateUser(
        mockUser.email,
        'password123',
      );

      expect(usersService.findUser).toHaveBeenCalledWith(mockUser.email);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      mockUsersService.findUser.mockRejectedValue(new NotFoundException());

      await expect(
        authService.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockJwtService.sign.mockReturnValueOnce(mockTokens.access_token);
      mockJwtService.sign.mockReturnValueOnce(mockTokens.refresh_token);

      const result = await authService.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('refreshToken', () => {
    it('should return a new access token when refresh token is valid', async () => {
      const mockPayload = { sub: 1, email: 'test@example.com' };
      const mockNewAccessToken = { access_token: 'new-access-token' };

      mockJwtService.verify.mockReturnValue(mockPayload);
      mockUsersService.findUser.mockResolvedValue(mockPayload);

      mockJwtService.sign.mockReturnValue(mockNewAccessToken.access_token);

      const result = await authService.refreshToken('valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: configService.get<string>('JWT_SECRET', 'mysecretkey'),
      });
      expect(result).toEqual(mockNewAccessToken);
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error();
      });

      await expect(
        authService.refreshToken('invalid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 1,
        email: 'test@example.com',
      });
      mockUsersService.findUser.mockResolvedValue(null);

      await expect(
        authService.refreshToken('valid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
