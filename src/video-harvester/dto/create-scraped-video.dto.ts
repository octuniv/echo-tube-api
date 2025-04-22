// src/video-harvester/dtos/create-scraped-video.dto.ts
import { IsString, IsUrl } from 'class-validator';

export class CreateScrapedVideoDto {
  @IsString()
  youtubeId: string;

  @IsString()
  title: string;

  @IsUrl()
  @IsString()
  link: string;

  @IsUrl()
  @IsString()
  thumbnailUrl: string;

  @IsString()
  channelTitle: string;

  @IsString()
  duration: string;

  @IsString()
  topic: string;
}
