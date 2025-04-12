import { CreateUserDto } from '@/users/dto/create-user.dto';
import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto extends PartialType(
  OmitType(CreateUserDto, ['name'] as const),
) {
  @ApiProperty({ required: true, example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ required: true, example: 'securePassword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
