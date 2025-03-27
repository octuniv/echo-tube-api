import { faker } from '@faker-js/faker';
import { Post } from '@/posts/entities/post.entity';
import { User } from '@/users/entities/user.entity';

// 가짜 User 생성 함수
const createFakeUser = (): Partial<User> => ({
  id: faker.number.int({ min: 1, max: 1000 }),
  nickname: faker.person.firstName(),
});

// 가짜 Post 생성 함수
export const createFakePost = (): Post => {
  const user = createFakeUser();

  const post = new Post();
  post.id = faker.number.int({ min: 1, max: 1000 });
  post.title = faker.lorem.sentence();
  post.content = faker.lorem.paragraphs(3);
  post.videoUrl = faker.datatype.boolean(0.3)
    ? faker.internet.url()
    : undefined;
  post.views = faker.number.int({ min: 0, max: 1000 });
  post.commentsCount = faker.number.int({ min: 0, max: 500 });
  post.createdBy = user as User;
  post.createdAt = faker.date.past();
  post.updatedAt = faker.date.recent();
  post.deletedAt = null;
  post.nickname = user.nickname;

  return post;
};
