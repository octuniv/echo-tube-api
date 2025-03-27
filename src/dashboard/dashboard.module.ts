import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';
import { VisitorModule } from '@/visitor/visitor.module';

@Module({
  imports: [VisitorModule, TypeOrmModule.forFeature([Post])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
