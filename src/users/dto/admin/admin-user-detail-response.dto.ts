// src/users/dto/admin/admin-user-detail-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsDate,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class AdminUserDetailResponseDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  @IsNumber()
  @Expose()
  id: number;

  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsString()
  @Expose()
  name: string;

  @ApiProperty({ example: 'johndoe123', description: 'User nickname' })
  @IsString()
  @Expose()
  nickname: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  @IsString()
  @Expose()
  email: string;

  @ApiProperty({
    example: UserRole.USER,
    enum: UserRole,
    description: 'User role (admin/user/bot)',
  })
  @IsEnum(UserRole)
  @Expose()
  role: UserRole;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: 'Account creation date',
  })
  @IsDate()
  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-02T00:00:00Z',
    description: 'Last update date',
  })
  @IsDate()
  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: null, description: 'Deletion date (null if active)' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @Expose()
  deletedAt: Date | null;
}
