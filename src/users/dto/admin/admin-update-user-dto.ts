// src/users/dto/admin/admin-update-user-dto.ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { AdminCreateUserDto } from './admin-create-user-dto';

export class AdminUpdateUserDto extends PartialType(
  OmitType(AdminCreateUserDto, ['email', 'password'] as const),
) {}
