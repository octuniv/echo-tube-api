// auth/dto/login-response.dto.ts
import { IsString, IsEmail, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@/users/entities/user-role.enum';

class UserResponse {
  @IsString()
  name: string;

  @IsString()
  nickname: string;

  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class LoginResponseDto {
  @IsString()
  access_token: string;

  @IsString()
  refresh_token: string;

  @ValidateNested()
  @Type(() => UserResponse)
  user: UserResponse;
}
