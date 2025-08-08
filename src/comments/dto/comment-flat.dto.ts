import { ApiProperty } from '@nestjs/swagger';

export class CommentFlatDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '게시물이 정말 좋네요!' })
  content: string;

  @ApiProperty({ example: 0 })
  likes: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updatedAt: Date;

  @ApiProperty({ description: '작성자 닉네임' })
  nickname: string;

  @ApiProperty({
    description: '부모 댓글 ID (대댓글인 경우)',
    nullable: true,
    example: 123,
  })
  parentId: number | null;

  @ApiProperty({
    description: '이 댓글에 대댓글이 있는지 여부',
    example: true,
  })
  hasReplies: boolean;
}
