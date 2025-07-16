// src/boards/tests/factories/board.factory.ts
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';
import { Board, BoardPurpose } from '../entities/board.entity';
import { faker } from '@faker-js/faker';
import { UserRole } from '@/users/entities/user-role.enum';

export const createBoard = (overrides: Partial<Board> = {}): Board => {
  const board = new Board();
  Object.assign(board, {
    id: faker.number.int({ min: 1, max: 1000 }),
    name: faker.commerce.productName(),
    description: faker.lorem.sentence(),
    category: createCategory(),
    categorySlug: createCategorySlug({
      slug: faker.helpers.slugify(faker.lorem.words()).toLowerCase(),
    }),

    requiredRole: UserRole.USER,
    type: BoardPurpose.GENERAL,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    posts: [],
    ...overrides,
  });
  return board;
};
