import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  boardSlug: string;

  @IsUrl()
  @IsOptional()
  videoUrl?: string;
}
