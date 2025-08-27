import { forwardRef, Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { BoardsModule } from '@/boards/boards.module';
import { CategoriesModule } from '@/categories/categories.module';
import { CommentsModule } from '@/comments/comments.module';
import { PostLike } from './entities/post-like.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostLike]),
    BoardsModule,
    CategoriesModule,
    forwardRef(() => CommentsModule),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
