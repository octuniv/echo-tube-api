import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { LoginUserDto } from './dto/login-user.dto';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  describe('login', () => {
    it('should return access and refresh tokens when credentials are valid', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      mockAuthService.validateUser.mockResolvedValue({
        id: 1,
        email: loginDto.email,
      });
      mockAuthService.login.mockResolvedValue(mockTokens);

      const result = await authController.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith({
        id: 1,
        email: loginDto.email,
      });
      expect(result).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.validateUser.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(authController.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new access token when refresh token is valid', async () => {
      const mockRefreshToken = 'valid-refresh-token';
      const mockAccessToken = { access_token: 'new-access-token' };

      mockAuthService.refreshToken.mockResolvedValue(mockAccessToken);

      const result = await authController.refreshToken(mockRefreshToken);

      expect(authService.refreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(result).toEqual(mockAccessToken);
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      await expect(authController.refreshToken(null)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
