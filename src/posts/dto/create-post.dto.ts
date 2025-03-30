import { IsString, IsOptional, IsUrl, IsInt } from 'class-validator';

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsInt()
  boardId: number;

  @IsUrl()
  @IsOptional()
  videoUrl?: string;
}
