import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'My First Post', description: 'Post title' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Post content...', description: 'Post body' })
  @IsString()
  content: string;

  @ApiProperty({ example: 'general', description: 'Target board slug' })
  @IsString()
  boardSlug: string;

  @ApiProperty({ example: 'https://example.com/video.mp4', required: false })
  @IsUrl()
  @IsOptional()
  videoUrl?: string;
}
