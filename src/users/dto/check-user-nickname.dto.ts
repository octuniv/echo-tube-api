import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class CheckNicknameRequest extends PartialType(
  PickType(CreateUserDto, ['nickname'] as const),
) {}
