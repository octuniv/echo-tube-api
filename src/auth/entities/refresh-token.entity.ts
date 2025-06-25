import { ApiTags, ApiProperty } from '@nestjs/swagger';
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@ApiTags('refresh-token')
@Index(['token', 'revoked'], { where: 'revoked = false' })
@Entity()
export class RefreshToken {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID 형식의 고유 토큰 식별자',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: '토큰과 연결된 사용자 이메일',
  })
  @Column()
  userEmail: string;

  @ApiProperty({
    format: 'password',
    example: 'abc123xyz... refreshTokenValue',
    description: '실제 리프레시 토큰 값 (고유 인덱스 적용)',
  })
  @Column({ unique: true })
  token: string;

  @ApiProperty({
    format: 'date-time',
    example: '2024-12-31T23:59:59Z',
    description: '토큰 만료 일시 (UTC)',
  })
  @Column()
  expiresAt: Date;

  @ApiProperty({
    enum: [true, false],
    example: false,
    readOnly: true,
    description: '토큰 취소 여부 (기본값: false)',
  })
  @Column({ default: false })
  revoked: boolean;
}
