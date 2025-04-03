// src/db/seeds/03-notice-board.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Category } from '@/categories/entities/category.entity';
import { Board } from '@/boards/entities/board.entity';
import { CategorySlug } from '@/categories/entities/category-slug.entity';
import { User } from '@/users/entities/user.entity';
import { Post } from '@/posts/entities/post.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { BaseSeeder } from './base.seeder';

export default class NoticeBoardSeeder extends BaseSeeder implements Seeder {
  private readonly NOTICE_CATEGORY = {
    name: '공지사항',
    slug: 'notices',
    board: {
      slug: 'notices',
      name: '공지 게시판',
      requiredRole: UserRole.ADMIN,
    },
  };

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const categoryRepo = dataSource.getRepository(Category);
      const slugRepo = dataSource.getRepository(CategorySlug);
      const boardRepo = dataSource.getRepository(Board);
      const postRepo = dataSource.getRepository(Post);
      const userRepo = dataSource.getRepository(User);

      // Create notice category
      let noticeCategory = await categoryRepo.findOneBy({
        name: this.NOTICE_CATEGORY.name,
      });
      if (!noticeCategory) {
        noticeCategory = await categoryRepo.save(
          categoryRepo.create({ name: this.NOTICE_CATEGORY.name }),
        );
      }

      // Create category slug
      if (
        !(await slugRepo.exists({
          where: { slug: this.NOTICE_CATEGORY.slug, category: noticeCategory },
        }))
      ) {
        await slugRepo.save(
          slugRepo.create({
            slug: this.NOTICE_CATEGORY.slug,
            category: noticeCategory,
          }),
        );
      }

      // Create notice board
      let noticeBoard = await boardRepo.findOneBy({
        slug: this.NOTICE_CATEGORY.board.slug,
      });
      if (!noticeBoard) {
        noticeBoard = await boardRepo.save(
          boardRepo.create({
            ...this.NOTICE_CATEGORY.board,
            category: noticeCategory,
          }),
        );
      }

      // Create system post
      const systemUser = await userRepo.findOneByOrFail({
        email: process.env.SYSTEM_USER_EMAIL || 'system@example.com',
      });
      const existingPost = await postRepo.findOneBy({
        title: '공지사항',
      });

      if (!existingPost) {
        await postRepo.save(
          postRepo.create({
            title: '공지사항',
            content: '현재 게시판은 공지사항 입니다.',
            board: noticeBoard,
            createdBy: systemUser,
            hotScore: 1000,
          }),
        );
      }
    });
  }
}
