import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { VisitorModule } from '@/visitor/visitor.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), VisitorModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [TypeOrmModule.forFeature([Post])],
})
export class PostsModule {}
