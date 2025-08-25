// src/db/seeds/05-posts-pagination-test.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource, Like } from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { Board } from '@/boards/entities/board.entity';
import { BaseSeeder } from './base.seeder';
import { CategorySlug } from '@/categories/entities/category-slug.entity';
import { Category } from '@/categories/entities/category.entity';
import { User } from '@/users/entities/user.entity';
import { UserRole } from '@/users/entities/user-role.enum';

export default class TestPostsSeeder extends BaseSeeder implements Seeder {
  private readonly PAGINATION_TEST_CATEGORY = {
    name: 'PAGINATIONTEST',
    slugs: ['paginationtest'],
    boards: [{ slug: 'paginationtest', name: 'PAGINATIONTEST' }],
  };

  private readonly TESTER_USER = {
    email: process.env.TESTER_EMAIL || 'test@example.com',
    password: process.env.TESTER_PASSWORD || 'tester123456',
  };

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const categoryRepo = dataSource.getRepository(Category);
      const slugRepo = dataSource.getRepository(CategorySlug);
      const boardRepo = dataSource.getRepository(Board);
      const postRepo = dataSource.getRepository(Post);
      const userRepo = dataSource.getRepository(User);

      // 테스트용 사용자 조회
      const testUser = await userRepo.findOneBy({
        email: this.TESTER_USER.email,
        role: UserRole.USER,
      });
      if (!testUser) {
        throw new Error('Test user not found. Please run user seeders first.');
      }

      // Create community category
      let community = await categoryRepo.findOneBy({
        name: this.PAGINATION_TEST_CATEGORY.name,
      });
      if (!community) {
        community = categoryRepo.create({
          name: this.PAGINATION_TEST_CATEGORY.name,
        });
        await categoryRepo.save(community);
      }

      // Create slugs and boards
      for (const slug of this.PAGINATION_TEST_CATEGORY.slugs) {
        if (
          !(await slugRepo.exists({
            where: { slug, category: { id: community.id } },
          }))
        ) {
          await slugRepo.save(slugRepo.create({ slug, category: community }));
        }
      }

      for (const boardConfig of this.PAGINATION_TEST_CATEGORY.boards) {
        const existingBoard = await boardRepo.findOne({
          where: { categorySlug: { slug: boardConfig.slug } },
          relations: { categorySlug: true },
        });

        if (!existingBoard) {
          const categorySlug = await slugRepo.findOne({
            where: {
              slug: boardConfig.slug,
              category: { id: community.id },
            },
          });

          await boardRepo.save(
            boardRepo.create({
              ...boardConfig,
              category: community,
              categorySlug: categorySlug!,
            }),
          );
        }
      }

      const testBoard = await boardRepo.findOne({
        where: { name: this.PAGINATION_TEST_CATEGORY.boards[0].name },
        relations: ['categorySlug'],
      });
      if (!testBoard) {
        throw new Error('Test board not found.');
      }

      // 기존 테스트 데이터 삭제 (중복 방지)
      await postRepo.delete({
        title: Like('Pagination Test Post%'),
        board: { id: testBoard.id },
      });

      // 6개의 테스트 게시물 생성
      const testPosts = [];
      for (let i = 1; i <= 6; i++) {
        testPosts.push(
          postRepo.create({
            title: `Pagination Test Post ${i}`,
            content: `Content for pagination test post ${i}`,
            views: 0,
            commentsCount: 0,
            hotScore: 0,
            createdBy: testUser,
            board: testBoard,
            createdAt: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          }),
        );
      }

      await postRepo.save(testPosts);
    });
  }
}
