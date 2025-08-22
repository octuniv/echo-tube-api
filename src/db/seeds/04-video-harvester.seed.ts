// src/db/seeds/04-video-harvester.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { BaseSeeder } from './base.seeder';
import { Category } from '@/categories/entities/category.entity';
import { CategorySlug } from '@/categories/entities/category-slug.entity';
import { Board, BoardPurpose } from '@/boards/entities/board.entity';
import { VideoFactory } from '@/video-harvester/factory/video.factory';
import { Post, PostOrigin } from '@/posts/entities/post.entity';

export default class VideoHarvesterSeeder extends BaseSeeder implements Seeder {
  private readonly BOT_ACCOUNT = {
    email: process.env.BOT_EMAIL || 'bot@example.com',
    password: process.env.BOT_PASSWORD || 'bot123456',
  };

  private readonly SCRAPER_CATEGORY = {
    name: 'SCRAPER',
    slug: 'nestjs',
    board: {
      slug: 'nestjs',
      name: 'NESTJS',
      requiredRole: UserRole.BOT,
      type: BoardPurpose.AI_DIGEST,
    },
  };

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const userRepo = dataSource.getRepository(User);
      const scraperBotAccount = await userRepo.findOneBy({
        email: this.BOT_ACCOUNT.email,
        role: UserRole.BOT,
      });

      if (!scraperBotAccount) {
        throw new Error('Test user not found. Please run user seeders first.');
      }

      const categoryRepo = dataSource.getRepository(Category);
      const slugRepo = dataSource.getRepository(CategorySlug);
      const boardRepo = dataSource.getRepository(Board);

      // Create category for scraper
      let scraperCategory = await categoryRepo.findOneBy({
        name: this.SCRAPER_CATEGORY.name,
      });
      if (!scraperCategory) {
        scraperCategory = categoryRepo.create({
          name: this.SCRAPER_CATEGORY.name,
        });
        await categoryRepo.save(scraperCategory);
      }

      // Create slugs and boards
      if (
        !(await slugRepo.exists({
          where: {
            slug: this.SCRAPER_CATEGORY.slug,
            category: scraperCategory,
          },
        }))
      ) {
        await slugRepo.save(
          slugRepo.create({
            slug: this.SCRAPER_CATEGORY.slug,
            category: scraperCategory,
          }),
        );
      }

      let nestjsBoard = await boardRepo.findOne({
        where: {
          type: BoardPurpose.AI_DIGEST,
          categorySlug: { slug: this.SCRAPER_CATEGORY.slug },
        },
        relations: { categorySlug: true },
      });

      if (!nestjsBoard) {
        const categorySlug = await slugRepo.findOne({
          where: {
            slug: this.SCRAPER_CATEGORY.slug,
          },
        });
        nestjsBoard = await boardRepo.save(
          boardRepo.create({
            ...this.SCRAPER_CATEGORY.board,
            category: scraperCategory,
            categorySlug,
          }),
        );
      }

      // Create Post like Scraping
      const postRepo = dataSource.getRepository(Post);
      const scrapedPost = new VideoFactory().create({
        youtubeId: 'GHTA143_b-s',
        topic: 'nestjs',
        title: '초보자를 위한 NestJs 과정 - REST API 만들기',
        duration: '3:42:08',
        channelTitle: 'freeCodeCamp.org',
      });

      const existingPost = await postRepo.findOneBy({
        title: scrapedPost.title,
      });

      if (!existingPost) {
        await postRepo.save(
          postRepo.create({
            type: PostOrigin.SCRAPED,
            title: scrapedPost.title,
            content: '',
            videoUrl: `https://www.youtube.com/watch?v=${scrapedPost.youtubeId}`,
            channelTitle: scrapedPost.channelTitle,
            duration: scrapedPost.duration,
            source: 'YouTube',
            board: nestjsBoard,
            createdBy: scraperBotAccount,
            hotScore: 3000,
          }),
        );
      }
    });
  }
}
