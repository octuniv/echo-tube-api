import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  jwtPayloadInterface,
  jwtValidatedOutputInterface,
} from './types/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'mysecretkey'),
    });
  }

  async validate(
    payload: jwtPayloadInterface,
  ): Promise<jwtValidatedOutputInterface> {
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
  }
}
