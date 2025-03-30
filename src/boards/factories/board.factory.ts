// src/boards/tests/factories/board.factory.ts
import { createCategory } from '@/categories/factories/category.factory';
import { Board } from '../entities/board.entity';
import { faker } from '@faker-js/faker';

export const createBoard = (overrides: Partial<Board> = {}): Board => {
  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    slug: faker.helpers.slugify(faker.lorem.words()).toLowerCase(),
    name: faker.commerce.productName(),
    description: faker.lorem.sentence(),
    category: createCategory(),
    posts: [],
    ...overrides,
  };
};
