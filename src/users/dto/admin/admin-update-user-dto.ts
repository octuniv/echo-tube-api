// src/users/dto/admin/admin-update-user-dto.ts
import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@/users/entities/user-role.enum';

export class AdminUpdateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'name should not be empty' }) // 빈 문자열 방지
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nickname should not be empty' }) // 빈 문자열 방지
  @IsOptional()
  nickname?: string;

  @IsEnum(UserRole)
  @IsNotEmpty({ message: 'role should not be empty' }) // 빈 문자열 방지
  @IsOptional()
  role?: UserRole; // 관리자만 수정 가능
}
