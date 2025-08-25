import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ example: '수정된 댓글 내용' })
  @IsNotEmpty()
  @IsString()
  content: string;
}
