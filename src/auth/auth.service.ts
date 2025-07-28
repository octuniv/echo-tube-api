import { UsersService } from '@/users/users.service';
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RefreshTokenRepository } from './refresh-token.repository';
import { jwtPayloadDto } from './types/jwt-payload.dto';
import { User } from '@/users/entities/user.entity';
import { VisitorService } from '@/visitor/visitor.service';
import { Transactional } from 'typeorm-transactional';
import { LoginResponseDto } from './dto/login-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly visitorService: VisitorService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.getUserByEmail(email).catch(() => {
      throw new UnauthorizedException('Invalid credentials');
    });
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    } else {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Transactional()
  async login(user: Partial<User>): Promise<LoginResponseDto> {
    const userId = user.id;
    if (!userId) {
      console.error('Invalid user object provided to login function');
      throw new UnauthorizedException('Invalid credentials');
    }

    let userInfo: User;
    try {
      userInfo = await this.usersService.getUserById(userId);
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Login failed due to database error',
      );
    }

    if (!userInfo) {
      console.error(`User ${userId} not found during login`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: jwtPayloadDto = {
      id: userInfo.id,
      email: userInfo.email,
      role: userInfo.role,
      nonce: crypto.randomUUID(),
    };

    try {
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.refreshTokenRepo.saveToken(
        userInfo.email,
        refreshToken,
        expiresAt,
      );
      await this.visitorService.upsertVisitorCount(userInfo.email);

      return {
        access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
        refresh_token: refreshToken,
        user: {
          name: userInfo.name,
          nickname: userInfo.nickname,
          email: userInfo.email,
          role: userInfo.role,
        },
      };
    } catch (error) {
      console.error(
        `Token generation failed for user ${userId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to generate authentication tokens',
      );
    }
  }

  @Transactional()
  async refreshToken(token: string) {
    try {
      const storedToken = await this.refreshTokenRepo.findValidToken(token);
      if (!storedToken || new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.refreshTokenRepo.revokeToken(storedToken.id);

      const user = await this.usersService.getUserByEmail(
        storedToken.userEmail,
      );
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        nonce: crypto.randomUUID(),
      } satisfies jwtPayloadDto;
      const newRefreshToken = this.jwtService.sign(payload, {
        expiresIn: '7d',
      });
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await this.refreshTokenRepo.saveToken(
        user.email,
        newRefreshToken,
        expiresAt,
      );

      const userIdentifier = user.email;
      await this.visitorService.upsertVisitorCount(userIdentifier);

      return {
        access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
        refresh_token: newRefreshToken, // 새로운 리프레시 토큰 반환
      };
    } catch (error) {
      if (error.status === 401) {
        throw error;
      } else {
        throw new InternalServerErrorException('Problem with token processing');
      }
    }
  }

  async validateAccessToken(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'mysecretkey'),
      });
      return !!payload; // 유효한 토큰이면 true 반환
    } catch (error) {
      return false; // 토큰이 유효하지 않으면 false 반환
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const storedToken =
        await this.refreshTokenRepo.findValidToken(refreshToken);
      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      await this.refreshTokenRepo.revokeToken(storedToken.id);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error(error);
      throw new InternalServerErrorException('Logout failed.');
    }
  }
}
