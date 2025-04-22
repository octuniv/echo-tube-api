// src/video-harvester/video-harvester.controller.ts
import { Controller, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { CreateScrapedVideoDto } from './dto/create-scraped-video.dto';
import { PostsService } from '@/posts/posts.service';
import { PostResponseDto } from '@/posts/dto/post-response.dto';

@Controller('harvest')
export class VideoHarvesterController {
  constructor(private readonly postsService: PostsService) {}

  // 봇 전용 영상 등록 (인증 필요)
  @Post('videos')
  @Roles(UserRole.BOT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createVideo(
    @Body() data: CreateScrapedVideoDto,
    @Query('slug') boardSlug: string,
    @Req() req: any,
  ): Promise<PostResponseDto> {
    const post = await this.postsService.createScrapedPost(
      data,
      boardSlug,
      req.user,
    );
    return PostResponseDto.fromEntity(post);
  }
}
