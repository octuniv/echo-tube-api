import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { VisitorModule } from '@/visitor/visitor.module';
import { PostsModule } from '@/posts/posts.module';

@Module({
  imports: [VisitorModule, PostsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
