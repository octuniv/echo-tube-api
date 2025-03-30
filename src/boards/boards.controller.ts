import { Controller, Get } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardListItemDto } from './dto/board-list-item.dto';

// boards.controller.ts
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  // 신규 엔드포인트 (일반 사용자용 간략 데이터)
  @Get()
  async findAllForList(): Promise<BoardListItemDto[]> {
    return this.boardsService.findAllForList();
  }
}
