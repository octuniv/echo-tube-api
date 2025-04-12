import { Controller, Get } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardListItemDto } from './dto/board-list-item.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Boards')
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all boards for listing' })
  @ApiResponse({
    status: 200,
    description: 'List of boards with essential information',
    type: [BoardListItemDto],
  })
  async findAllForList(): Promise<BoardListItemDto[]> {
    return this.boardsService.findAllForList();
  }
}
