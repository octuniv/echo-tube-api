import { ApiProperty } from '@nestjs/swagger';

export class UserDeleteResponseDto {
  @ApiProperty({ example: 'Successfully deleted user' })
  message: string;

  @ApiProperty({ example: true })
  success: boolean;
}
