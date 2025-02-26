import { IsString, IsOptional, IsDateString, IsUrl } from 'class-validator';

export class QueryPostDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  nickName?: string; // 가상 필드

  @IsDateString()
  createdAt: Date;

  @IsDateString()
  updatedAt: Date;

  // Entity에서 DTO로 변환하는 정적 메서드
  static fromEntity(post: any): QueryPostDto {
    const dto = new QueryPostDto();
    dto.id = post.id;
    dto.title = post.title;
    dto.content = post.content;
    dto.videoUrl = post.videoUrl || undefined; // 선택적 필드 처리
    dto.nickName = post.nickName || undefined; // 가상 필드 처리
    dto.createdAt = post.createdAt;
    dto.updatedAt = post.updatedAt;
    return dto;
  }
}
