import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { LoginUserDto } from './dto/login-user.dto';

describe('AuthController', () => {
  let authController: AuthController;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn().mockResolvedValue({ access_token: 'mocked-jwt-token' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  it('should return a JWT token when credentials are valid', async () => {
    mockAuthService.validateUser.mockResolvedValue({
      email: 'test@example.com',
    });

    const result = await authController.login({
      email: 'test@example.com',
      password: 'password123',
    } satisfies LoginUserDto);

    expect(result).toEqual({ access_token: 'mocked-jwt-token' });
  });

  it('should throw UnauthorizedException if credentials are invalid', async () => {
    mockAuthService.validateUser.mockResolvedValue(null);

    await expect(
      authController.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      } satisfies LoginUserDto),
    ).rejects.toThrow(UnauthorizedException);
  });
});
