// src/messages/message.controller.ts

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
} from '@nestjs/swagger';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import {
  MessageListItemDto,
  MessageDetailDto,
} from './dto/message-response.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '메시지 전송',
    description: '1:1 메시지 또는 공지 메시지를 전송합니다.',
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: 201,
    description: '메시지 전송 성공',
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
    description: '사용자가 받은 모든 메시지의 간략한 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '메시지 목록 조회 성공',
    type: [MessageListItemDto],
  })
  async findAll(@Req() req: RequestWithUser) {
    return this.messageService.findAll(req.user);
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
