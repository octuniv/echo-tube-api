// src/db/seeds/06-comments-test.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource, Like } from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { Board } from '@/boards/entities/board.entity';
import { BaseSeeder } from './base.seeder';
import { CategorySlug } from '@/categories/entities/category-slug.entity';
import { Category } from '@/categories/entities/category.entity';
import { User } from '@/users/entities/user.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { Comment } from '@/comments/entities/comment.entity';

export default class TestCommentsSeeder extends BaseSeeder implements Seeder {
  private readonly COMMENT_TEST_CATEGORY = {
    name: 'COMMENTTEST',
    slugs: ['commenttest'],
    boards: [{ slug: 'commenttest', name: 'COMMENTTEST' }],
  };

  private readonly TESTER_USERS = [
    {
      email: process.env.TESTER_EMAIL || 'test@example.com',
      password: process.env.TESTER_PASSWORD || 'tester123456',
    },
    {
      email: process.env.TESTER2_EMAIL || 'test2@example.com',
      password: process.env.TESTER2_PASSWORD || 'tester123456',
    },
  ];

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const categoryRepo = dataSource.getRepository(Category);
      const slugRepo = dataSource.getRepository(CategorySlug);
      const boardRepo = dataSource.getRepository(Board);
      const postRepo = dataSource.getRepository(Post);
      const userRepo = dataSource.getRepository(User);
      const commentRepo = dataSource.getRepository(Comment);

      const testUsers = await Promise.all(
        this.TESTER_USERS.map(async (testUser) => {
          const user = await userRepo.findOneBy({
            email: testUser.email,
            role: UserRole.USER,
          });
          if (!user) {
            throw new Error(`Test user not found: ${testUser.email}`);
          }
          return user;
        }),
      );

      // Create community category
      let community = await categoryRepo.findOneBy({
        name: this.COMMENT_TEST_CATEGORY.name,
      });
      if (!community) {
        community = categoryRepo.create({
          name: this.COMMENT_TEST_CATEGORY.name,
        });
        await categoryRepo.save(community);
      }

      // Create slugs and boards
      for (const slug of this.COMMENT_TEST_CATEGORY.slugs) {
        if (
          !(await slugRepo.exists({
            where: { slug, category: { id: community.id } },
          }))
        ) {
          await slugRepo.save(slugRepo.create({ slug, category: community }));
        }
      }

      for (const boardConfig of this.COMMENT_TEST_CATEGORY.boards) {
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
        where: { name: this.COMMENT_TEST_CATEGORY.boards[0].name },
        relations: ['categorySlug'],
      });
      if (!testBoard) {
        throw new Error('Test board not found.');
      }

      // 기존 테스트 데이터 삭제 (중복 방지)
      await postRepo.delete({
        title: Like('Comment Test Post%'),
        board: { id: testBoard.id },
      });

      const postForTest = postRepo.create({
        title: `Comment Test Post`,
        content: `Content for comment test post`,
        views: 0,
        commentsCount: 0,
        hotScore: 0,
        createdBy: testUsers[0],
        board: testBoard,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedPost = await postRepo.save(postForTest);

      // 15개의 부모 댓글 생성
      const parentComments = [];
      for (let i = 0; i < 15; i++) {
        const parentComment = commentRepo.create({
          content: `부모 댓글 ${i + 1}`,
          post: savedPost,
          createdBy: testUsers[0],
          createdAt: new Date(Date.now() - (15 - i) * 1000), // 시간 순서대로 생성
          updatedAt: new Date(Date.now() - (15 - i) * 1000),
        });
        const savedParent = await commentRepo.save(parentComment);
        parentComments.push(savedParent);

        // 짝수 인덱스: 1개의 대댓글, 홀수 인덱스: 2개의 대댓글
        const replyCount = i % 2 === 0 ? 1 : 2;
        for (let j = 0; j < replyCount; j++) {
          const childComment = commentRepo.create({
            content: `대댓글 ${i + 1}-${j + 1}`,
            post: savedPost,
            createdBy: testUsers[1],
            parent: savedParent,
            createdAt: new Date(Date.now() - (15 - i) * 1000 + (j + 1) * 100),
            updatedAt: new Date(Date.now() - (15 - i) * 1000 + (j + 1) * 100),
          });
          await commentRepo.save(childComment);
        }
      }

      // 댓글 수 업데이트
      savedPost.commentsCount = parentComments.length;
      await postRepo.save(savedPost);
    });
  }
}
