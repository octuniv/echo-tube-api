import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '@/users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenRepository } from './refresh-token.repository';
import { VisitorModule } from '@/visitor/visitor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]), // 추가
    ConfigModule.forRoot(),
    UsersModule,
    VisitorModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule], // Ensure ConfigModule is available
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'mysecretkey'), // Load secret from env
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        }, // Load expiration from env
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, RefreshTokenRepository],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
