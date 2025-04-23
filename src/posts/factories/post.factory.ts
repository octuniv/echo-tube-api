import { faker } from '@faker-js/faker';
import { Post, PostOrigin } from '@/posts/entities/post.entity';
import { createBoard } from '@/boards/factories/board.factory';
import { createUserEntity } from '@/users/factory/user.factory';

// 가짜 Post 생성 함수
export const createPost = (options?: Partial<Post>): Post => {
  const post = new Post();
  post.id = options.id ?? faker.number.int({ min: 1, max: 1000 });
  post.title = faker.lorem.sentence();
  post.content = faker.lorem.paragraphs(3);
  post.videoUrl = faker.datatype.boolean(0.3)
    ? faker.internet.url()
    : undefined;
  post.views = faker.number.int({ min: 0, max: 1000 });
  post.commentsCount = faker.number.int({ min: 0, max: 500 });
  post.createdBy = options.createdBy ?? createUserEntity();
  post.createdAt = faker.date.past();
  post.updatedAt = faker.date.recent();
  post.deletedAt = null;
  post.board = options.board ?? createBoard();
  post.hotScore = faker.number.float({ min: 0, max: 100 });

  post.type = PostOrigin.USER;
  post.channelTitle = null;
  post.duration = null;
  post.source = null;

  post.setNickname();

  return Object.assign(post, options);
};
