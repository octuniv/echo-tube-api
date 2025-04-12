import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeletePostResultDto {
  @ApiProperty({ example: 'Post deleted successfully' })
  @IsString()
  message: string;
}
