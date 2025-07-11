import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  Put,
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
import { UpdateBoardDto } from '@/admin/board/dto/CRUD/update-board.dto';
import { CreateBoardDto } from '@/admin/board/dto/CRUD/create-board.dto';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { AdminBoardResponseDto } from '@/admin/board/dto/admin-board-response.dto';
import { BOARD_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';

@ApiTags('admin-boards')
@Controller('admin/boards')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiResponse({
  status: 401,
  description: '인증 실패',
  schema: {
    example: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
    },
  },
})
@ApiResponse({
  status: 403,
  description: '접근 권한 없음',
  schema: {
    example: {
      statusCode: 403,
      message: 'Forbidden resource',
      error: 'Forbidden',
    },
  },
})
@ApiResponse({
  status: 500,
  description: '서버 내부 오류',
  schema: {
    example: {
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    },
  },
})
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
    example: {
      default: { value: 1 },
      'invalid-id': { value: 'invalid' },
    },
    description: '조회할 게시판의 ID',
  })
  @ApiResponse({
    status: 200,
    type: AdminBoardResponseDto,
    description: '성공적으로 조회됨',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 ID 형식',
    examples: {
      'invalid-id': {
        summary: '잘못된 ID 형식',
        value: {
          statusCode: 400,
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
        },
      },
    },
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
      'invalid-slug': {
        value: {
          slug: 'invalid slug!',
          name: 'Invalid Board',
          categoryId: 1,
        },
        description: '잘못된 슬러그 형식',
      },
      'duplicate-slug': {
        value: {
          slug: 'existing-board',
          name: 'Existing Board',
          categoryId: 1,
        },
        description: '중복된 슬러그',
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: AdminBoardResponseDto,
    description: '성공적으로 생성됨',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청',
    examples: {
      'duplicate-slug': {
        summary: '중복된 슬러그',
        value: {
          statusCode: 400,
          message: BOARD_ERROR_MESSAGES.DUPLICATE_SLUG('general'),
          error: 'Bad Request',
        },
      },
      'invalid-slug': {
        summary: '카테고리 슬러그 제한',
        value: {
          statusCode: 400,
          message: BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY('general'),
          error: 'Bad Request',
        },
      },
      'ai-digest-role': {
        summary: 'AI_DIGEST 권한 요구',
        value: {
          statusCode: 400,
          message: BOARD_ERROR_MESSAGES.AI_DIGEST_REQUIRES_HIGHER_ROLE,
          error: 'Bad Request',
        },
      },
    },
  })
  async createBoard(
    @Body() dto: CreateBoardDto,
  ): Promise<AdminBoardResponseDto> {
    const board = await this.boardsService.create(dto);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Put(':id')
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
      'invalid-slug': {
        value: {
          slug: 'invalid slug!',
          name: 'Invalid Board',
          categoryId: 1,
        },
        description: '잘못된 슬러그 형식',
      },
      'duplicate-slug': {
        value: {
          slug: 'existing-board',
          name: 'Existing Board',
          categoryId: 1,
        },
        description: '중복된 슬러그',
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: AdminBoardResponseDto,
    description: '성공적으로 업데이트됨',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청',
    examples: {
      'duplicate-slug': {
        summary: '중복된 슬러그',
        value: {
          statusCode: 400,
          message: BOARD_ERROR_MESSAGES.DUPLICATE_SLUG('general'),
          error: 'Bad Request',
        },
      },
      'slug-not-allowed': {
        summary: '카테고리 슬러그 제한',
        value: {
          statusCode: 400,
          message: BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY('general'),
          error: 'Bad Request',
        },
      },
      'ai-digest-role': {
        summary: 'AI_DIGEST 권한 요구',
        value: {
          statusCode: 400,
          message: BOARD_ERROR_MESSAGES.AI_DIGEST_REQUIRES_HIGHER_ROLE,
          error: 'Bad Request',
        },
      },
      'invalid-id-format': {
        summary: '잘못된 ID 형식',
        value: {
          statusCode: 400,
          message: 'Validation failed (numeric string is expected)',
          error: 'Bad Request',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '게시판을 찾을 수 없음',
    example: {
      statusCode: 404,
      message: BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD,
      error: 'Not Found',
    },
  })
  async updateBoard(
    @Param('id', ParseIntPipe) id: string,
    @Body() dto: UpdateBoardDto,
  ): Promise<AdminBoardResponseDto> {
    const board = await this.boardsService.update(+id, dto);
    return AdminBoardResponseDto.fromEntity(board);
  }

  @Delete(':id')
  @HttpCode(204)
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
    status: 204,
    description: '삭제 성공 (응답 없음)',
  })
  @ApiResponse({
    status: 404,
    description: '게시판을 찾을 수 없음',
  })
  async deleteBoard(@Param('id', ParseIntPipe) id: string): Promise<void> {
    return this.boardsService.remove(+id);
  }
}
