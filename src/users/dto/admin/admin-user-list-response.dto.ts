// src/users/dto/admin/admin-user-list-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';

export class AdminUserListResponseDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'johndoe123', description: 'User nickname' })
  @IsString()
  nickname: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  @IsString()
  email: string;

  @ApiProperty({
    example: UserRole.USER,
    enum: UserRole,
    description: 'User role (admin/user/bot)',
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: 'Account creation date',
  })
  @IsString()
  createdAt: Date;

  @ApiProperty({ example: null, description: 'Deletion date (null if active)' })
  @IsOptional()
  deletedAt: Date | null;
}
