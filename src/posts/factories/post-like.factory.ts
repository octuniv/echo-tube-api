import { PostLike } from '../entities/post-like.entity';

export function createPostLike(overrides?: Partial<PostLike>): PostLike {
  const postLike = new PostLike();
  postLike.userId = overrides?.userId ?? 1;
  postLike.postId = overrides?.postId ?? 1;
  postLike.createdAt = overrides?.createdAt ?? new Date();
  return postLike;
}
