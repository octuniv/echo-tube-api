import { createUserEntity } from '@/users/factory/user.factory';
import { Comment } from '../entities/comment.entity';
import { createPost } from '@/posts/factories/post.factory';

// comments.factory.ts
export function createComment(override?: Partial<Comment>): Comment {
  const comment = new Comment();
  comment.id = override?.id || 1;
  comment.content = override?.content || 'Test Comment';
  comment.createdAt = override?.createdAt || new Date();
  comment.updatedAt = override?.updatedAt || new Date();
  comment.createdBy = override?.createdBy || createUserEntity();
  comment.post = override?.post || createPost();
  comment.parent = override?.parent || null;
  comment.children = override?.children || [];
  comment.likes = override?.likes || 0;

  return comment;
}
