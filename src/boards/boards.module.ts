import { Module } from '@nestjs/common';
import { Board } from './entities/board.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardsService } from './boards.service';

@Module({
  imports: [TypeOrmModule.forFeature([Board])],
  exports: [TypeOrmModule.forFeature([Board]), BoardsService],
  providers: [BoardsService],
})
export class BoardsModule {}
