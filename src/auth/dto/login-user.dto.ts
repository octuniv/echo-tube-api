import { CreateUserDto } from '@/users/dto/create-user.dto';
import { OmitType, PartialType } from '@nestjs/mapped-types';

export class LoginUserDto extends PartialType(
  OmitType(CreateUserDto, ['name'] as const),
) {}
