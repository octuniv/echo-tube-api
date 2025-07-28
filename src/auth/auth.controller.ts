import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login with email/password' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async login(@Body() loginUserDto: LoginUserDto): Promise<LoginResponseDto> {
    /*
    
    ToDO : apply two-factor authentication to adminstrator
    
    */
    const user = await this.authService.validateUser(
      loginUserDto.email,
      loginUserDto.password,
    );
    return this.authService.login(user);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiOkResponse({
    schema: {
      example: {
        access_token: 'new.jwt.token...',
        refresh_token: 'new.refresh.token...',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refresh_token: { type: 'string' } },
    },
  })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshToken(refreshToken);
  }

  @Get('validate-token')
  @ApiOperation({ summary: 'Validate access token' })
  @ApiOkResponse({ schema: { example: { valid: true } } })
  @ApiUnauthorizedResponse({ description: 'Invalid/missing token' })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer token (e.g., "Bearer abcxyz...")',
  })
  async validateToken(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const isValid = await this.authService.validateAccessToken(token);

    return { valid: isValid };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout user by invalidating refresh token' })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refresh_token: { type: 'string' } },
    },
  })
  async logout(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    await this.authService.logout(refreshToken);
    return { message: 'Successfully logged out' };
  }
}
