import { IsNumber, ValidateNested, IsArray, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';
import { PostResponseDto } from '@/posts/dto/post-response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({ example: 150, description: "Today's unique visitor count" })
  @IsNumber()
  @IsDefined()
  visitors: number;

  @ApiProperty({
    description: 'Latest posts (excluding notices)',
    type: [PostResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostResponseDto)
  recentPosts: PostResponseDto[];

  @ApiProperty({
    description: 'Most popular posts (excluding notices)',
    type: [PostResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostResponseDto)
  popularPosts: PostResponseDto[];

  @ApiProperty({
    description: 'Important notice posts',
    type: [PostResponseDto],
  })
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
