import { IsEnum } from 'class-validator';
import { CreateUserDto } from '../create-user.dto';
import { UserRole } from '@/users/entities/user-role.enum';

export class AdminCreateUserDto extends CreateUserDto {
  @IsEnum(UserRole)
  role: UserRole;
}
