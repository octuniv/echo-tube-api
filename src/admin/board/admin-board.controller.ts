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
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Roles } from '@/auth/roles.decorator';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { BoardsService } from '@/boards/boards.service';
import { UpdateBoardDto } from '@/boards/dto/update-board.dto';
import { CreateBoardDto } from '@/boards/dto/create-board.dto';
import { AdminBoardResponseDto } from '@/boards/dto/admin-board-response.dto';
import { BoardPurpose } from '@/boards/entities/board.entity';

@ApiTags('admin-boards')
@Controller('admin/boards')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminBoardController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  @ApiOperation({
    summary: '모든 게시판 목록 조회',
    description: '관리자 권한으로 모든 게시판의 상세 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    type: [AdminBoardResponseDto],
    description: '성공적으로 조회됨',
  })
  async getBoards(): Promise<AdminBoardResponseDto[]> {
    const boards = await this.boardsService.findAll();
    return boards.map(AdminBoardResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({
    summary: '게시판 상세 조회',
    description: '특정 ID의 게시판 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '조회할 게시판의 ID',
  })
  @ApiResponse({
    status: 200,
    type: AdminBoardResponseDto,
    description: '성공적으로 조회됨',
  })
  @ApiResponse({
    status: 404,
    description: '게시판을 찾을 수 없음',
  })
  async getBoardDetails(
    @Param('id', ParseIntPipe) id: string,
  ): Promise<AdminBoardResponseDto> {
    const board = await this.boardsService.findOne(+id);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Post()
  @ApiOperation({
    summary: '새 게시판 생성',
    description: '새로운 게시판을 생성합니다.',
  })
  @ApiBody({
    type: CreateBoardDto,
    examples: {
      default: {
        value: {
          slug: 'general',
          name: 'General Discussion',
          description: 'General discussion board',
          requiredRole: UserRole.USER,
          type: BoardPurpose.GENERAL,
          categoryId: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: AdminBoardResponseDto,
    description: '성공적으로 생성됨',
  })
  async createBoard(
    @Body() dto: CreateBoardDto,
  ): Promise<AdminBoardResponseDto> {
    const board = await this.boardsService.create(dto);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '게시판 정보 업데이트',
    description: '특정 ID의 게시판 정보를 업데이트합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '업데이트할 게시판의 ID',
  })
  @ApiBody({
    type: UpdateBoardDto,
    examples: {
      default: {
        value: {
          name: 'Updated Discussion',
          requiredRole: UserRole.ADMIN,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: AdminBoardResponseDto,
    description: '성공적으로 업데이트됨',
  })
  async updateBoard(
    @Param('id', ParseIntPipe) id: string,
    @Body() dto: UpdateBoardDto,
  ): Promise<AdminBoardResponseDto> {
    const board = await this.boardsService.update(+id, dto);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '게시판 삭제',
    description:
      '특정 ID의 게시판을 삭제합니다 (연관된 게시글도 함께 삭제됩니다).',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    example: 1,
    description: '삭제할 게시판의 ID',
  })
  @ApiResponse({
    status: 200,
    description: '성공적으로 삭제됨',
  })
  @ApiResponse({
    status: 404,
    description: '게시판을 찾을 수 없음',
  })
  async deleteBoard(@Param('id', ParseIntPipe) id: string): Promise<void> {
    return this.boardsService.remove(+id);
  }
}
