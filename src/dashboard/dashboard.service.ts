import { Repository } from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { VisitorService } from '@/visitor/visitor.service';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PopularPost } from './types/popularpost.types';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    private visitorsService: VisitorService,
  ) {}

  async getDashboardSummary(): Promise<{
    visitors: number;
    popularPosts: PopularPost[];
  }> {
    const [popularPosts, visitors] = await Promise.all([
      this.postRepository.find({
        order: { views: 'DESC' },
        take: 3,
        select: ['id', 'title', 'views'],
      }),
      this.visitorsService.getTodayVisitors(),
    ]);

    return {
      visitors,
      popularPosts: popularPosts.map((post) => ({
        id: post.id,
        title: post.title,
        views: post.views,
      })),
    };
  }
}
