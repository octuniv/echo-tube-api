import { UserRole } from '@/users/entities/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class jwtPayloadDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'JWT 고유성을 보장하기 위한 무작위 값 (nonce)',
  })
  nonce: string;
}

export class jwtValidatedOutputDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;
}
