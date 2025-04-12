import {
  IsString,
  IsOptional,
  IsDate,
  IsUrl,
  IsNumber,
  ValidateNested,
  IsDefined,
} from 'class-validator';
import { Post } from '../entities/post.entity';
import { BoardListItemDto } from '@/boards/dto/board-list-item.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty({ type: Number }) // Swagger 타입 명시
  @IsNumber()
  id: number;

  @ApiProperty({ type: String })
  @IsString()
  title: string;

  @ApiProperty({ type: String })
  @IsString()
  content: string;

  @ApiProperty({ type: Number })
  @IsNumber()
  views: number;

  @ApiProperty({ type: Number })
  @IsNumber()
  commentsCount: number;

  @ApiProperty({ type: String, required: false }) // 선택적 필드
  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @ApiProperty({ type: String, required: false })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({ type: Date })
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: Date })
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiProperty({ type: BoardListItemDto }) // 중첩 객체 타입
  @ValidateNested({ message: '게시판 정보가 유효하지 않습니다' })
  @IsDefined({ message: '게시판 정보는 필수입니다' })
  @Type(() => BoardListItemDto)
  board: BoardListItemDto;

  @ApiProperty({ type: Number })
  @IsNumber()
  hotScore: number;

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
    };
    dto.hotScore = post.hotScore;
    return dto;
  }
}
