import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { jwtPayloadDto, jwtValidatedOutputDto } from './types/jwt-payload.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'mysecretkey'),
    });
  }

  async validate(payload: jwtPayloadDto): Promise<jwtValidatedOutputDto> {
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
  }
}
