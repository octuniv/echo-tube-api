import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { BoardsModule } from '@/boards/boards.module';
import { CategoriesModule } from '@/categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), BoardsModule, CategoriesModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [TypeOrmModule.forFeature([Post])],
})
export class PostsModule {}
