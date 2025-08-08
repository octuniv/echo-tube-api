import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: '게시물이 정말 좋네요!' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ example: 1, description: '댓글을 달 게시물 ID' })
  @IsNotEmpty()
  @IsNumber()
  postId: number;

  @ApiProperty({
    example: 1,
    description: '대댓글인 경우 부모 댓글 ID',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  parentId?: number;
}
