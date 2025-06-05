import {
  Controller,
  // Get,
  // Post,
  // Patch,
  // Delete,
  // Param,
  // Body,
  UseGuards,
} from '@nestjs/common';
// import { CreateBoardDto } from './dto/create-board.dto';
// import { UpdateBoardDto } from './dto/update-board.dto';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { BoardsService } from '@/boards/boards.service';

@ApiTags('admin-boards')
@Controller('admin/boards')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminBoardController {
  constructor(private readonly boardsService: BoardsService) {}

  // @Get()
  // async getBoards() {
  //   // 전체 게시판 조회 (카테고리 포함)
  //   return this.boardService.findAll();
  // }

  // @Post()
  // async createBoard(@Body() dto: CreateBoardDto) {
  //   // 새 게시판 생성
  //   return this.boardService.create(dto);
  // }

  // @Get(':id')
  // async getBoardDetails(@Param('id') id: string) {
  //   // 특정 게시판 상세 조회
  //   return this.boardService.findOne(+id);
  // }

  // @Patch(':id')
  // async updateBoard(@Param('id') id: string, @Body() dto: UpdateBoardDto) {
  //   // 게시판 정보 업데이트
  //   return this.boardService.update(+id, dto);
  // }

  // @Delete(':id')
  // async deleteBoard(@Param('id') id: string) {
  //   // 게시판 삭제
  //   return this.boardService.remove(+id);
  // }
}
