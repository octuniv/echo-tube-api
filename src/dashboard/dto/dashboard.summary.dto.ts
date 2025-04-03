import { IsNumber, ValidateNested, IsArray, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';
import { PostResponseDto } from '@/posts/dto/post-response.dto';

export class DashboardSummaryDto {
  @IsNumber()
  @IsDefined()
  visitors: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostResponseDto)
  recentPosts: PostResponseDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostResponseDto)
  popularPosts: PostResponseDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostResponseDto)
  noticesPosts: PostResponseDto[];

  static fromData(
    visitors: number,
    recentPosts: PostResponseDto[],
    popularPosts: PostResponseDto[],
    noticesPosts: PostResponseDto[],
  ): DashboardSummaryDto {
    const dto = new DashboardSummaryDto();
    dto.visitors = visitors;
    dto.recentPosts = recentPosts;
    dto.popularPosts = popularPosts;
    dto.noticesPosts = noticesPosts;
    return dto;
  }
}
