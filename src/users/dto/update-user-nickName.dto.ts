import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserNicknameRequest extends PartialType(
  PickType(CreateUserDto, ['nickName'] as const),
) {}
