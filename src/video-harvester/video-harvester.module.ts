import { Module } from '@nestjs/common';
import { VideoHarvesterController } from './video-harvester.controller';
import { PostsModule } from '@/posts/posts.module';

@Module({
  imports: [PostsModule],
  controllers: [VideoHarvesterController],
})
export class VideoHarvesterModule {}
