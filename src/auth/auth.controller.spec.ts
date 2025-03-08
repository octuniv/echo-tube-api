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
    validateAccessToken: jest.fn(),
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
    it('should return access, refresh tokens and userInfo when credentials are valid', async () => {
      const loginDto: LoginUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResult = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        name: 'John',
        nickname: 'John Doe',
        email: 'test@example.com',
      };

      mockAuthService.validateUser.mockResolvedValue({
        id: 1,
        email: loginDto.email,
      });
      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await authController.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith({
        id: 1,
        email: loginDto.email,
      });
      expect(result).toEqual(mockResult);
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

    it('should throw UnauthorizedException if email or password is missing', async () => {
      const invalidLoginDto = { email: '', password: '' };

      await expect(authController.login(invalidLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new access token when refresh token is valid', async () => {
      const mockRefreshToken = 'valid-refresh-token';
      const mockReturnedToken = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      mockAuthService.refreshToken.mockResolvedValue(mockReturnedToken);

      const result = await authController.refreshToken(mockRefreshToken);

      expect(authService.refreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(result).toEqual(mockReturnedToken);
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      await expect(authController.refreshToken(null)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validate-token', () => {
    it('should return true when access token is valid', async () => {
      const mockValidToken = 'Bearer is-valid-token';
      mockAuthService.validateAccessToken.mockResolvedValue(true);
      expect(authController.validateToken(mockValidToken)).resolves.toEqual({
        valid: true,
      });
    });

    it('should return false when access token is invalid', async () => {
      const mockInvalidToken = 'Bearer is-invalid-token';
      mockAuthService.validateAccessToken.mockResolvedValue(false);
      expect(authController.validateToken(mockInvalidToken)).resolves.toEqual({
        valid: false,
      });
    });
  });
});
