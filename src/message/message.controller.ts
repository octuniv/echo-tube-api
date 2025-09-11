import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiResponse,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import {
  MessageListItemDto,
  MessageDetailDto,
} from './dto/message-response.dto';
import { CreateNoticeResponseDto } from './dto/create-message-response.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    description: `
    - 일반 메시지: \`receiverId\` 필수
    - 공지 메시지(\`isNotice: true\`): \`receiverId\` 생략 가능
  `,
    schema: {
      type: 'object',
      properties: {
        receiverId: {
          type: 'number',
          description: '수신자 ID (공지 메시지일 경우 생략 가능)',
          example: 2,
        },
        content: {
          type: 'string',
          description: '메시지 내용',
          example: '안녕하세요!',
        },
        isNotice: {
          type: 'boolean',
          description: '공지 메시지 여부',
          example: false,
        },
      },
      required: ['content'],
    },
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: 201,
    description: '개인 메시지 전송 성공',
    type: MessageDetailDto,
    schema: {
      example: {
        id: 101,
        senderId: 1,
        receiverId: 2,
        content: '안녕하세요!',
        isRead: false,
        createdAt: '2025-04-05T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '공지 메시지 전송 성공',
    type: CreateNoticeResponseDto,
    schema: {
      example: {
        noticeId: 'notice-101',
        content: '시스템 점검 안내',
        sentTo: 15000,
        createdAt: '2025-04-05T10:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '공지 메시지는 관리자만 발송 가능합니다.',
  })
  async create(
    @Body() createMessageDto: CreateMessageDto,
    @Req() req: RequestWithUser,
  ) {
    return this.messageService.create(req.user, createMessageDto);
  }

  @Get()
  @ApiOperation({
    summary: '받은 메시지 목록 조회',
    description:
      '사용자가 받은 모든 메시지의 간략한 목록을 페이징하여 조회합니다.',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: '페이지 번호',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: '한 페이지당 항목 수',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: '메시지 목록 조회 성공',
    type: PaginatedResponseDto<MessageListItemDto>,
    schema: {
      allOf: [
        { $ref: '#/components/schemas/PaginatedResponseDto' },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/MessageListItemDto' },
            },
          },
        },
      ],
    },
  })
  async findAll(
    @Req() req: RequestWithUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.messageService.findAll(req.user, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: '메시지 상세 조회',
    description:
      '특정 메시지의 전체 내용을 조회합니다. 조회 시 자동으로 읽음 처리됩니다.',
  })
  @ApiParam({ name: 'id', type: Number, description: '조회할 메시지 ID' })
  @ApiResponse({
    status: 200,
    description: '메시지 상세 조회 성공',
    type: MessageDetailDto,
  })
  @ApiResponse({ status: 404, description: '메시지를 찾을 수 없습니다.' })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.messageService.findOne(+id, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '메시지 삭제',
    description: '특정 메시지를 소프트 삭제합니다.',
  })
  @ApiParam({ name: 'id', type: Number, description: '삭제할 메시지 ID' })
  @ApiResponse({
    status: 200,
    description: '메시지 삭제 성공',
    schema: { example: { message: '메시지가 삭제되었습니다.' } },
  })
  @ApiResponse({ status: 404, description: '메시지를 찾을 수 없습니다.' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.messageService.remove(+id, req.user);
  }
}
