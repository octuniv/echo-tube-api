import { Module } from '@nestjs/common';
import { Board } from './entities/board.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Board])],
  exports: [TypeOrmModule.forFeature([Board]), BoardsService],
  providers: [BoardsService],
  controllers: [BoardsController],
})
export class BoardsModule {}
