import { ApiProperty } from '@nestjs/swagger';

export class LikeResponseDto {
  @ApiProperty({ description: 'Post ID' })
  postId: number;

  @ApiProperty({ description: 'Total like count' })
  likesCount: number;

  @ApiProperty({ description: 'Whether the like was added by this request' })
  isAdded: boolean;
}
