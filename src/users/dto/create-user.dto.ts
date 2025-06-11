import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty({ message: 'name should not be empty' })
  name: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty({ message: 'Nickname should not be empty' })
  nickname: string;

  @ApiProperty({ required: true })
  @IsEmail()
  @IsNotEmpty({ message: 'Email should not be empty' })
  email: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty({ message: 'Password should not be empty' })
  password: string;
}
