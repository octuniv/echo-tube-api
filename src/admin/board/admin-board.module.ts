import { BoardsModule } from '@/boards/boards.module';
import { Module } from '@nestjs/common';
import { AdminBoardController } from './admin-board.controller';

@Module({
  imports: [BoardsModule],
  controllers: [AdminBoardController],
  providers: [],
})
export class AdminBoardModule {}
