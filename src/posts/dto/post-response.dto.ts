import {
  IsString,
  IsOptional,
  IsDate,
  IsUrl,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Post, PostOrigin } from '../entities/post.entity';
import { BoardListItemDto } from '@/boards/dto/board-list-item.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 'My First Post' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Post content...' })
  @IsString()
  content: string;

  @ApiProperty({ example: 0 })
  @IsNumber()
  views: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  commentsCount: number;

  @ApiProperty({ example: 'https://example.com/video.mp4', required: false })
  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @ApiProperty({
    example: 'john_doe',
    description: "Author's nickname (from User entity)",
    required: false,
  })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiProperty({ type: BoardListItemDto })
  @ValidateNested()
  @Type(() => BoardListItemDto)
  board: BoardListItemDto;

  @ApiProperty({ example: 123.45 })
  @IsNumber()
  hotScore: number;

  @ApiProperty({ enum: PostOrigin })
  type: PostOrigin;

  @ApiProperty({ required: false })
  channelTitle?: string;

  @ApiProperty({ required: false })
  duration?: string;

  // Entity에서 DTO로 변환하는 정적 메서드
  static fromEntity(post: Post): PostResponseDto {
    const dto = new PostResponseDto();
    dto.id = post.id;
    dto.title = post.title;
    dto.content = post.content;
    dto.views = post.views;
    dto.commentsCount = post.commentsCount;
    dto.videoUrl = post.videoUrl || undefined; // 선택적 필드 처리
    dto.nickname = post.nickname || undefined; // 가상 필드 처리
    dto.createdAt = post.createdAt;
    dto.updatedAt = post.updatedAt;
    dto.board = {
      id: post.board.id,
      slug: post.board.slug,
      name: post.board.name,
      description: post.board.description,
      requiredRole: post.board.requiredRole,
      boardType: post.board.type,
    };
    dto.hotScore = post.hotScore;
    // 봇에 의해 수집된 영상 게시물 정보
    dto.type = post.type;
    dto.channelTitle = post.channelTitle || undefined;
    dto.duration = post.duration || undefined;
    return dto;
  }
}
