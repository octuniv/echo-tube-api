import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { BoardsService } from '@/boards/boards.service';
import { UpdateBoardDto } from '@/boards/dto/update-board.dto';
import { CreateBoardDto } from '@/boards/dto/create-board.dto';
import { AdminBoardResponseDto } from '@/boards/dto/admin-board-response.dto';

@ApiTags('admin-boards')
@Controller('admin/boards')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminBoardController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  async getBoards(): Promise<AdminBoardResponseDto[]> {
    const boards = await this.boardsService.findAll();
    return boards.map(AdminBoardResponseDto.fromEntity);
  }

  @Get(':id')
  async getBoardDetails(
    @Param('id', ParseIntPipe) id: string,
  ): Promise<AdminBoardResponseDto> {
    const board = await this.boardsService.findOne(+id);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Post()
  async createBoard(
    @Body() dto: CreateBoardDto,
  ): Promise<AdminBoardResponseDto> {
    // 새 게시판 생성
    const board = await this.boardsService.create(dto);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Patch(':id')
  async updateBoard(
    @Param('id', ParseIntPipe) id: string,
    @Body() dto: UpdateBoardDto,
  ): Promise<AdminBoardResponseDto> {
    // 게시판 정보 업데이트
    const board = await this.boardsService.update(+id, dto);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Delete(':id')
  async deleteBoard(@Param('id', ParseIntPipe) id: string): Promise<void> {
    // 게시판 삭제
    return this.boardsService.remove(+id);
  }
}
