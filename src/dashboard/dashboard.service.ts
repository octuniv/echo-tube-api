import { VisitorService } from '@/visitor/visitor.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PostsService } from '@/posts/posts.service';
import { DashboardSummaryDto } from './dto/dashboard.summary.dto';

export const NOTICE_BOARD_SLUG = 'notices';

@Injectable()
export class DashboardService {
  constructor(
    private postsService: PostsService,
    private visitorsService: VisitorService,
  ) {}

  // caching 작업 필요
  async getDashboardSummary(): Promise<DashboardSummaryDto> {
    try {
      const [popularPosts, recentPosts, visitors, noticesPosts] =
        await Promise.all([
          this.postsService.findPopularPosts([NOTICE_BOARD_SLUG]), // 공지사항 제외
          this.postsService.findRecentPosts([], 10, [NOTICE_BOARD_SLUG]), // 공지사항 제외
          this.visitorsService.getTodayVisitors(),
          this.postsService.findPostsByBoardSlug('notices'),
        ]);

      return DashboardSummaryDto.fromData(
        visitors,
        recentPosts,
        popularPosts,
        noticesPosts,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        '대시보드 데이터를 불러오지 못했습니다.',
      );
    }
  }
}
