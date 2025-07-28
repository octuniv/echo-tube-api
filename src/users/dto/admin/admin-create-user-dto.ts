import { IsEnum, IsNotEmpty } from 'class-validator';
import { CreateUserDto } from '../create-user.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class AdminCreateUserDto extends CreateUserDto {
  @ApiProperty({ required: true })
  @IsEnum(UserRole)
  @IsNotEmpty({ message: 'role should not be empty' })
  role: UserRole;
}
