import { Module } from '@nestjs/common';
import { Board } from './entities/board.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { CategoriesModule } from '@/categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([Board]), CategoriesModule],
  exports: [BoardsService],
  providers: [BoardsService],
  controllers: [BoardsController],
})
export class BoardsModule {}
