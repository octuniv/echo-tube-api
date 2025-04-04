import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createUserEntity } from '@/users/factory/user.factory';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenRepository } from './refresh-token.repository';
import { VisitorService } from '@/visitor/visitor.service';
import { createMock } from '@golevelup/ts-jest';
import { User } from '@/users/entities/user.entity';
import { UserRole } from '@/users/entities/user-role.enum';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let visitorService: VisitorService;
  let refreshTokenRepo: RefreshTokenRepository;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: createMock<UsersService>() },
        { provide: JwtService, useValue: createMock<JwtService>() },
        {
          provide: RefreshTokenRepository,
          useValue: createMock<RefreshTokenRepository>(),
        },
        { provide: VisitorService, useValue: createMock<VisitorService>() },
        { provide: ConfigService, useValue: createMock<ConfigService>() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    visitorService = module.get<VisitorService>(VisitorService);
    refreshTokenRepo = module.get<RefreshTokenRepository>(
      RefreshTokenRepository,
    );
    configService = module.get(ConfigService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const mockUser = createUserEntity();
      const password = 'password123';
      mockUser.passwordHash = await bcrypt.hash(password, 10);

      jest.spyOn(usersService, 'getUserByEmail').mockResolvedValue(mockUser);

      const result = await authService.validateUser(
        mockUser.email,
        'password123',
      );

      expect(usersService.getUserByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      jest
        .spyOn(usersService, 'getUserByEmail')
        .mockRejectedValue(new NotFoundException());

      await expect(
        authService.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle unexpected errors during user validation', async () => {
      jest
        .spyOn(usersService, 'getUserByEmail')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(
        authService.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return DTO with user information and tokens', async () => {
      const mockUser: Partial<User> = {
        id: 1,
        email: 'test@example.com',
        role: UserRole.USER,
      };
      const mockUserInfo: User = {
        ...(mockUser as User),
        name: 'Test User',
        nickname: 'testuser',
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        posts: [],
      };

      jest.spyOn(usersService, 'getUserById').mockResolvedValue(mockUserInfo);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('access-token');

      const result = await authService.login(mockUser);

      expect(usersService.getUserById).toHaveBeenCalledWith(mockUser.id);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { id: 1, email: 'test@example.com', role: UserRole.USER },
        { expiresIn: '7d' },
      );
      expect(refreshTokenRepo.saveToken).toHaveBeenCalledWith(
        mockUser.email,
        'refresh-token',
        expect.any(Date),
      );
      expect(visitorService.upsertVisitorCount).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          name: 'Test User',
          nickname: 'testuser',
          email: 'test@example.com',
          role: UserRole.USER,
        },
      });
    });

    it('should throw UnauthorizedException when user id is missing', async () => {
      await expect(authService.login({} as User)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh token and update storage', async () => {
      const mockStoredToken = {
        id: '1',
        userEmail: 'test@example.com',
        token: 'old-refresh-token',
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
      };

      const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        role: UserRole.USER,
        name: 'Test User',
        nickname: 'testuser',
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        posts: [],
      };

      jest
        .spyOn(refreshTokenRepo, 'findValidToken')
        .mockResolvedValue(mockStoredToken);
      jest.spyOn(usersService, 'getUserByEmail').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign').mockReturnValue('new-refresh-token');

      const result = await authService.refreshToken('old-token');

      expect(refreshTokenRepo.revokeToken).toHaveBeenCalledWith('1');
      expect(refreshTokenRepo.saveToken).toHaveBeenCalledWith(
        mockUser.email,
        'new-refresh-token',
        expect.any(Date),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        { id: 1, email: 'test@example.com', role: UserRole.USER },
        { expiresIn: '7d' },
      );
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });
  });

  describe('validateAccessToken', () => {
    it('should verify token with correct secret', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('test-secret');
      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: 1, email: 'test@example.com' });

      const result = await authService.validateAccessToken('valid-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
      expect(result).toBe(true);
    });
  });
});
