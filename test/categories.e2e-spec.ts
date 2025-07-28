import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { setupTestApp, truncateAllTables } from './utils/test.util';
import { DataSource } from 'typeorm';
import { Category } from '@/categories/entities/category.entity';
import { CategorySlug } from '@/categories/entities/category-slug.entity';
import { Board, BoardPurpose } from '@/boards/entities/board.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { CategoryWithBoardsResponse } from '@/categories/dto/category-specific/category-with-boards.dto';
import { CategoryBoardGroup } from '@/categories/dto/category-specific/category-board-group.dto';

export async function upsertCategory(
  categoryData: {
    name: string;
    slugs: string[];
    boards: {
      slug: string;
      name: string;
      description?: string;
      requiredRole?: UserRole;
      type?: BoardPurpose;
    }[];
  },
  dataSource: DataSource,
): Promise<void> {
  const categoryRepo = dataSource.getRepository(Category);
  const slugRepo = dataSource.getRepository(CategorySlug);
  const boardRepo = dataSource.getRepository(Board);

  let category = await categoryRepo.findOneBy({ name: categoryData.name });
  if (!category) {
    category = categoryRepo.create({ name: categoryData.name });
    await categoryRepo.save(category);
  }

  for (const slug of categoryData.slugs) {
    const exists = await slugRepo.exists({
      where: { slug, category: { id: category.id } },
    });
    if (!exists) {
      await slugRepo.save(slugRepo.create({ slug, category }));
    }
  }

  for (const boardConfig of categoryData.boards) {
    const exists = await boardRepo.findOne({
      where: { categorySlug: { slug: boardConfig.slug } },
      relations: { categorySlug: true },
    });
    if (!exists) {
      const categorySlug = await slugRepo.findOne({
        where: { slug: boardConfig.slug },
      });
      await boardRepo.save(
        boardRepo.create({
          ...boardConfig,
          category,
          categorySlug,
        }),
      );
    }
  }
}

describe('CategoriesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    app = testApp.app;
    dataSource = testApp.dataSource;
  }, 15000);

  beforeEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  describe('GET /categories', () => {
    beforeEach(async () => {
      await truncateAllTables(dataSource);
    });

    it('/categories (GET) - 성공', async () => {
      const communityCategory = {
        name: '커뮤니티',
        slugs: ['free'],
        boards: [{ slug: 'free', name: '자유 게시판' }],
      };
      await upsertCategory(communityCategory, dataSource);

      const expectedCategories = [
        {
          name: '커뮤니티',
          allowedSlugs: ['free'],
        },
      ];

      return request(app.getHttpServer())
        .get('/categories')
        .expect(200)
        .then((response) => {
          expectedCategories.forEach((category) => {
            expect(response.body).toContainEqual(
              expect.objectContaining(category),
            );
          });
        });
    });
  });

  describe('GET /categories/with-boards', () => {
    beforeEach(async () => {
      await truncateAllTables(dataSource);
    });

    it('/categories/with-boards (GET) - 기본 성공', async () => {
      const aiCategory = {
        name: 'AI',
        slugs: ['ai-general', 'ai-digest'],
        boards: [
          {
            slug: 'ai-general',
            name: '일반 게시판',
            type: BoardPurpose.GENERAL,
          },
          {
            slug: 'ai-digest',
            name: '요약 게시판',
            type: BoardPurpose.AI_DIGEST,
          },
        ],
      };

      const communityCategory = {
        name: '커뮤니티',
        slugs: ['community-general'],
        boards: [
          {
            slug: 'community-general',
            name: '자유 게시판',
            type: BoardPurpose.GENERAL,
          },
        ],
      };

      await upsertCategory(aiCategory, dataSource);
      await upsertCategory(communityCategory, dataSource);

      const response = await request(app.getHttpServer())
        .get('/categories/with-boards')
        .expect(200);

      expect(response.body).toHaveLength(2);

      const aiResponse = response.body.find(
        (c: CategoryWithBoardsResponse) => c.name === 'AI',
      );
      expect(aiResponse.boardGroups).toHaveLength(2);

      const generalGroup = aiResponse.boardGroups.find(
        (g: CategoryBoardGroup) => g.purpose === BoardPurpose.GENERAL,
      );
      expect(generalGroup.boards).toEqual([
        {
          id: expect.any(Number),
          slug: 'ai-general',
          name: '일반 게시판',
        },
      ]);

      const digestGroup = aiResponse.boardGroups.find(
        (g: CategoryBoardGroup) => g.purpose === BoardPurpose.AI_DIGEST,
      );
      expect(digestGroup.boards).toEqual([
        {
          id: expect.any(Number),
          slug: 'ai-digest',
          name: '요약 게시판',
        },
      ]);

      const communityResponse = response.body.find(
        (c: CategoryWithBoardsResponse) => c.name === '커뮤니티',
      );
      expect(communityResponse.boardGroups).toHaveLength(2);

      const communityGeneralGroup = communityResponse.boardGroups.find(
        (g: CategoryBoardGroup) => g.purpose === BoardPurpose.GENERAL,
      );
      expect(communityGeneralGroup.boards).toEqual([
        {
          id: expect.any(Number),
          slug: 'community-general',
          name: '자유 게시판',
        },
      ]);
    });

    it('/categories/with-boards (GET) - 보드 없는 카테고리', async () => {
      const emptyCategory = {
        name: '빈 카테고리',
        slugs: [],
        boards: [],
      };
      await upsertCategory(emptyCategory, dataSource);

      const response = await request(app.getHttpServer())
        .get('/categories/with-boards')
        .expect(200);

      const emptyCategoryReturned = response.body.find(
        (c: CategoryWithBoardsResponse) => c.name === '빈 카테고리',
      );
      expect(emptyCategoryReturned.boardGroups).toEqual([
        { purpose: BoardPurpose.GENERAL, boards: [] },
        { purpose: BoardPurpose.AI_DIGEST, boards: [] },
      ]);
    });

    it('/categories/with-boards (GET) - 카테고리 없음', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories/with-boards')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('/categories/with-boards (GET) - 특정 보드 용도만 존재', async () => {
      const aiCategory = {
        name: 'AI',
        slugs: ['ai-digest'],
        boards: [
          {
            slug: 'ai-digest',
            name: '요약 게시판',
            type: BoardPurpose.AI_DIGEST,
          },
        ],
      };

      await upsertCategory(aiCategory, dataSource);

      const response = await request(app.getHttpServer())
        .get('/categories/with-boards')
        .expect(200);

      const aiCategoryReturned = response.body[0];
      const generalGroup = aiCategoryReturned.boardGroups.find(
        (g: CategoryBoardGroup) => g.purpose === BoardPurpose.GENERAL,
      );
      expect(generalGroup.boards).toEqual([]);
    });
  });
});
