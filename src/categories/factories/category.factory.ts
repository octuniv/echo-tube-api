// src/categories/tests/factories/category.factory.ts
import { Category } from '../entities/category.entity';
import { CategorySlug } from '../entities/category-slug.entity';
import { faker } from '@faker-js/faker';

export const createCategory = (overrides: Partial<Category> = {}): Category => {
  const category: Category = {
    id: faker.number.int({ min: 1, max: 100 }),
    name: faker.commerce.department(),
    slugs: [],
    boards: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };

  // 카테고리와 연결된 슬러그 생성
  if (overrides.slugs && overrides.slugs.length > 0) {
    category.slugs = overrides.slugs as CategorySlug[];
  } else {
    category.slugs = [
      createCategorySlug({ slug: 'announcements' }),
      createCategorySlug({ slug: 'notices' }),
    ];
  }

  return category;
};

export const createCategorySlug = (
  overrides: Partial<CategorySlug> = {},
): CategorySlug => {
  return {
    id: faker.number.int({ min: 1, max: 100 }),
    slug: faker.helpers.slugify(faker.lorem.words()),
    category: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
};
