import { Post } from '@/posts/entities/post.entity';
import { PickType } from '@nestjs/mapped-types';

export class PopularPost extends PickType(Post, [
  'id',
  'title',
  'hotScore',
] as const) {
  boardName: string;
}
