// src/db/seeds/categories-and-boards.seed.ts
import { Seeder /*, SeederFactoryManager*/ } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Category } from '@/categories/entities/category.entity';
import { Board } from '@/boards/entities/board.entity';
import { CategorySlug } from '@/categories/entities/category-slug.entity';

export default class CategoriesAndBoardsSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    // factoryManager: SeederFactoryManager,
  ): Promise<void> {
    const categoryRepository = dataSource.getRepository(Category);
    const boardRepository = dataSource.getRepository(Board);
    const categorySlugRepository = dataSource.getRepository(CategorySlug);

    // 1. 커뮤니티 카테고리 생성 또는 조회
    let communityCategory = await categoryRepository.findOneBy({
      name: '커뮤니티',
    });

    if (!communityCategory) {
      communityCategory = categoryRepository.create({ name: '커뮤니티' });
      await categoryRepository.save(communityCategory);
    }

    // 2. 'free' 슬러그 생성 및 카테고리 연결
    let freeSlug = await categorySlugRepository.findOne({
      where: { slug: 'free', category: { id: communityCategory.id } },
      relations: ['category'],
    });

    if (!freeSlug) {
      freeSlug = categorySlugRepository.create({
        slug: 'free',
        category: communityCategory,
      });
      await categorySlugRepository.save(freeSlug);
    }

    // 3. 자유 게시판 생성 (이미 존재하는지 확인)
    const freeBoard = await boardRepository.findOneBy({ slug: 'free' });
    if (!freeBoard) {
      const newBoard = boardRepository.create({
        slug: 'free',
        name: '자유 게시판',
        category: communityCategory,
      });
      await boardRepository.save(newBoard);
    }
  }
}
