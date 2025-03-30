import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MakeUserEntityFaker } from '@/users/faker/user.faker';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenRepository } from './refresh-token.repository';
import { VisitorService } from '@/visitor/visitor.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let visitorService: VisitorService;
  let refreshTokenRepo: RefreshTokenRepository;

  const mockUsersService = {
    getUserByEmail: jest.fn(),
    isUserExists: jest.fn(),
    getUserById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockRefreshTokenRepo = {
    saveToken: jest.fn(),
    findValidToken: jest.fn(),
    revokeToken: jest.fn(),
  };

  const mockVisitorService = {
    upsertVisitorCount: jest.fn(),
  };

  const mockDataSource = {
    manager: {
      save: jest.fn(),
      transaction: jest.fn(),
    },
    createEntityManager: jest.fn(),
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ConfigService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RefreshTokenRepository, useValue: mockRefreshTokenRepo },
        { provide: VisitorService, useValue: mockVisitorService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    visitorService = module.get<VisitorService>(VisitorService);
    refreshTokenRepo = module.get<RefreshTokenRepository>(
      RefreshTokenRepository,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const mockUser = MakeUserEntityFaker();
      const password = 'password123';
      mockUser.passwordHash = await bcrypt.hash(password, 10);

      mockUsersService.getUserByEmail.mockResolvedValue(mockUser);

      const result = await authService.validateUser(
        mockUser.email,
        'password123',
      );

      expect(usersService.getUserByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      mockUsersService.getUserByEmail.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        authService.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle unexpected errors during user validation', async () => {
      mockUsersService.getUserByEmail.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        authService.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const mockUser = MakeUserEntityFaker();
      const mockResult = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        name: mockUser.name,
        nickname: mockUser.nickname,
        email: mockUser.email,
      };

      mockJwtService.sign.mockReturnValueOnce(mockResult.refresh_token);
      mockJwtService.sign.mockReturnValueOnce(mockResult.access_token);
      mockUsersService.getUserById.mockResolvedValue(mockUser);
      mockDataSource.manager = { ...mockDataSource.manager };

      const result = await authService.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(refreshTokenRepo.saveToken).toHaveBeenCalledWith(
        mockUser.email,
        mockResult.refresh_token,
        expect.any(Date),
      );

      expect(visitorService.upsertVisitorCount).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('refreshToken', () => {
    it('should save a new refresh token and revoke the old one', async () => {
      const mockUser = MakeUserEntityFaker();
      const mockOldToken = 'old-refresh-token';
      const mockNewToken = 'refresh-token';

      // Mocking repository methods
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);
      mockRefreshTokenRepo.findValidToken.mockResolvedValue({
        id: mockUser.id,
        userEmail: mockUser.email,
        expiresAt: expiresAt,
      });
      mockRefreshTokenRepo.revokeToken.mockResolvedValue(undefined);
      mockJwtService.sign.mockReturnValueOnce(mockNewToken);
      mockRefreshTokenRepo.saveToken.mockResolvedValue(undefined);
      mockUsersService.getUserByEmail.mockResolvedValue(mockUser);

      // Call the method
      const result = await authService.refreshToken(mockOldToken);

      // Assertions
      expect(refreshTokenRepo.findValidToken).toHaveBeenCalledWith(
        mockOldToken,
      );
      expect(refreshTokenRepo.revokeToken).toHaveBeenCalledWith(mockUser.id);
      expect(refreshTokenRepo.saveToken).toHaveBeenCalledWith(
        mockUser.email,
        mockNewToken, // New token
        expect.any(Date), // Expiration date
      );
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(visitorService.upsertVisitorCount).toHaveBeenCalledWith(
        mockUser.email,
      );
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      const mockWrongToken = 'wrong-token';
      mockRefreshTokenRepo.findValidToken.mockResolvedValue(null);
      expect(authService.refreshToken(mockWrongToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      const mockExpiredToken = 'expired-token';
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() - 2);
      const expiredToken = {
        revoked: false,
        expiresAt: expireDate,
      };
      mockRefreshTokenRepo.findValidToken.mockResolvedValue(expiredToken);
      expect(authService.refreshToken(mockExpiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateAccessToken', () => {
    it('should return true for a valid access token', async () => {
      const mockToken = 'valid-access-token';
      mockJwtService.verify.mockReturnValue({
        sub: 1,
        email: 'test@example.com',
      });

      const result = await authService.validateAccessToken(mockToken);

      expect(jwtService.verify).toHaveBeenCalledWith(mockToken, {
        secret: expect.any(String),
      });
      expect(result).toBe(true);
    });

    it('should return false for an invalid access token', async () => {
      const mockToken = 'invalid-access-token';
      mockJwtService.verify.mockImplementation(() => {
        throw new Error();
      });

      const result = await authService.validateAccessToken(mockToken);

      expect(jwtService.verify).toHaveBeenCalledWith(mockToken, {
        secret: expect.any(String),
      });
      expect(result).toBe(false);
    });
  });
});
