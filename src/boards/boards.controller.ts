import { Controller, Get, UseGuards } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardListItemDto } from './dto/board-list-item.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ScrapingTargetBoardDto } from './dto/scraping-target-board.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorator';
import { UserRole } from '@/users/entities/user-role.enum';

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

  @Get('scraping-targets')
  @ApiOperation({
    summary: 'Get boards for video scraping integration',
    description:
      'Returns boards designated for automated video scraping (YouTube API/Selenium)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of video boards for content scraping',
    type: [ScrapingTargetBoardDto],
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BOT)
  async getScrapingTargets(): Promise<ScrapingTargetBoardDto[]> {
    return this.boardsService.getScrapingTargetBoards();
  }
}
