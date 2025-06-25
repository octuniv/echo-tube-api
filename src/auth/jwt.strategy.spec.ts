import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '@/users/entities/user-role.enum';
import { jwtPayloadDto, jwtValidatedOutputDto } from './types/jwt-payload.dto';
import * as crypto from 'crypto';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      JWT_SECRET: 'test-secret-key',
    });

    jwtStrategy = new JwtStrategy(configService);
  });

  it('should be defined', () => {
    expect(jwtStrategy).toBeDefined();
  });

  it('should extract JWT from the authorization header', () => {
    expect(jwtStrategy['_jwtFromRequest']).toBeInstanceOf(Function);

    // Verify function behavior instead of direct equality check
    const extractedToken = jwtStrategy['_jwtFromRequest']({
      headers: { authorization: 'Bearer sample-token' },
    });
    expect(extractedToken).toBe('sample-token');
  });

  it('should have ignoreExpiration set to false', () => {
    expect(jwtStrategy['_verifOpts'].ignoreExpiration).toBe(false);
  });

  it('should have the correct secret key', () => {
    const secretKey = jwtStrategy['configService'].get('JWT_SECRET');
    expect(secretKey).toBe('test-secret-key');
  });

  it('should validate the payload and return the user object', async () => {
    const payload = {
      id: 1,
      email: 'test@example.com',
      role: UserRole.USER,
      nonce: crypto.randomUUID(),
    } satisfies jwtPayloadDto;
    const result = await jwtStrategy.validate(payload);

    expect(result).toEqual({
      id: 1,
      email: 'test@example.com',
      role: UserRole.USER,
    } satisfies jwtValidatedOutputDto);
  });
});
