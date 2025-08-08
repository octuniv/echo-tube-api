import { ApiProperty } from '@nestjs/swagger';

export class CommentResponseDto {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({ example: '댓글이 성공적으로 생성되었습니다.' })
  message: string;
}
