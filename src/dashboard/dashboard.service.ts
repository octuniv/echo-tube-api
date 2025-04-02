import { VisitorService } from '@/visitor/visitor.service';
import { Injectable } from '@nestjs/common';
import { PostsService } from '@/posts/posts.service';
import { PostResponseDto } from '@/posts/dto/post-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    private postsService: PostsService,
    private visitorsService: VisitorService,
  ) {}

  async getDashboardSummary(): Promise<{
    visitors: number;
    recentPosts: PostResponseDto[];
    popularPosts: PostResponseDto[];
  }> {
    const [popularPosts, recentPosts, visitors] = await Promise.all([
      this.postsService.findPopularPosts(),
      this.postsService.findRecentPosts(),
      this.visitorsService.getTodayVisitors(),
    ]);

    return { visitors, recentPosts, popularPosts };
  }
}
