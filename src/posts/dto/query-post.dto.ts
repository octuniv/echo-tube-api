import {
  IsString,
  IsOptional,
  IsDateString,
  IsUrl,
  IsNumber,
} from 'class-validator';
import { Post } from '../entities/post.entity';

export class QueryPostDto {
  @IsNumber()
  id: number;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsNumber()
  views: number;

  @IsNumber()
  commentsCount: number;

  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  nickname?: string; // 가상 필드

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  // Entity에서 DTO로 변환하는 정적 메서드
  static fromEntity(post: Post): QueryPostDto {
    const dto = new QueryPostDto();
    dto.id = post.id;
    dto.title = post.title;
    dto.content = post.content;
    dto.views = post.views;
    dto.commentsCount = post.commentsCount;
    dto.videoUrl = post.videoUrl || undefined; // 선택적 필드 처리
    dto.nickname = post.nickname || undefined; // 가상 필드 처리
    dto.createdAt = post.createdAt;
    dto.updatedAt = post.updatedAt;
    return dto;
  }
}
