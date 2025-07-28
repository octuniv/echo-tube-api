// src/users/dto/admin/admin-user-update-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AdminUserUpdateResponseDto {
  @ApiProperty({ example: 'Successfully updated user' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;
}
