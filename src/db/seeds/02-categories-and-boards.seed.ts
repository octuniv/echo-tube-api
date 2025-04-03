// src/db/seeds/02-categories-and-boards.seed.ts
import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Category } from '@/categories/entities/category.entity';
import { Board } from '@/boards/entities/board.entity';
import { CategorySlug } from '@/categories/entities/category-slug.entity';
import { BaseSeeder } from './base.seeder';

export default class CategoriesAndBoardsSeeder
  extends BaseSeeder
  implements Seeder
{
  private readonly COMMUNITY_CATEGORY = {
    name: '커뮤니티',
    slugs: ['free'],
    boards: [{ slug: 'free', name: '자유 게시판' }],
  };

  public async run(dataSource: DataSource): Promise<void> {
    await this.withTransaction(dataSource, async () => {
      const categoryRepo = dataSource.getRepository(Category);
      const slugRepo = dataSource.getRepository(CategorySlug);
      const boardRepo = dataSource.getRepository(Board);

      // Create community category
      let community = await categoryRepo.findOneBy({
        name: this.COMMUNITY_CATEGORY.name,
      });
      if (!community) {
        community = categoryRepo.create({ name: this.COMMUNITY_CATEGORY.name });
        await categoryRepo.save(community);
      }

      // Create slugs and boards
      for (const slug of this.COMMUNITY_CATEGORY.slugs) {
        if (
          !(await slugRepo.exists({
            where: { slug, category: { id: community.id } },
          }))
        ) {
          await slugRepo.save(slugRepo.create({ slug, category: community }));
        }
      }

      for (const boardConfig of this.COMMUNITY_CATEGORY.boards) {
        if (!(await boardRepo.exists({ where: { slug: boardConfig.slug } }))) {
          await boardRepo.save(
            boardRepo.create({
              ...boardConfig,
              category: community,
            }),
          );
        }
      }
    });
  }
}
