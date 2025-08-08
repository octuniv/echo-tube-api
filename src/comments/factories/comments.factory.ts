import { Comment } from '../entities/comment.entity';

export const createComment = (overrides = {}) => {
  return {
    id: 1,
    content: 'Test Comment',
    likes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [],
    ...overrides,
  } as Comment;
};
