import { Repository } from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { VisitorService } from '@/visitor/visitor.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
        order: { hotScore: 'DESC' },
        take: 10,
        relations: ['board'],
        select: {
          id: true,
          title: true,
          hotScore: true,
          board: {
            name: true,
          },
        },
      }),
      this.visitorsService.getTodayVisitors(),
    ]);

    return {
      visitors,
      popularPosts: popularPosts.map((post) => ({
        id: post.id,
        title: post.title,
        boardName:
          post.board?.name ??
          (() => {
            throw new InternalServerErrorException(
              '게시판 정보가 손상되었습니다',
            );
          })(),
        hotScore: post.hotScore,
      })),
    };
  }
}
