import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class CheckEmailRequest extends PartialType(
  PickType(CreateUserDto, ['email'] as const),
) {}
