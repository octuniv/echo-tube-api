// src/video-harvester/dtos/create-scraped-video.dto.ts
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateScrapedVideoDto {
  @IsString()
  @IsNotEmpty({ message: 'youtubeId should not be empty' })
  youtubeId: string;

  @IsString()
  title: string;

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
