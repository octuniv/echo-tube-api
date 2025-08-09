import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  COMMENT_ERRORS,
  COMMENT_MESSAGES,
} from './constants/comment.constants';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CommentListItemDto } from './dto/comment-list-item.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '댓글 생성' })
  @ApiResponse({
    status: 201,
    description: COMMENT_MESSAGES.CREATED,
    type: CommentResponseDto,
  })
  @ApiResponse({ status: 400, description: COMMENT_ERRORS.MAX_DEPTH_EXCEEDED })
  @ApiResponse({ status: 404, description: COMMENT_ERRORS.POST_NOT_FOUND })
  create(
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.commentsService.create(createCommentDto, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '댓글 수정' })
  @ApiResponse({
    status: 200,
    description: COMMENT_MESSAGES.UPDATED,
    type: CommentResponseDto,
  })
  @ApiResponse({ status: 404, description: COMMENT_ERRORS.NOT_FOUND })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.commentsService.update(id, updateCommentDto, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '댓글 삭제' })
  @ApiResponse({
    status: 200,
    description: COMMENT_MESSAGES.DELETED,
    type: CommentResponseDto,
  })
  @ApiResponse({ status: 403, description: COMMENT_ERRORS.NO_PERMISSION })
  @ApiResponse({ status: 404, description: COMMENT_ERRORS.NOT_FOUND })
  @ApiResponse({
    status: 500,
    description: '댓글 삭제 중 문제가 발생했습니다.',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.commentsService.remove(id, req.user);
  }

  @Get('post/:postId')
  @ApiOperation({ summary: '게시물의 댓글 목록 조회 (페이징)' })
  @ApiResponse({
    status: 200,
    description: '댓글 목록이 성공적으로 조회되었습니다.',
    type: PaginatedResponseDto<CommentListItemDto>,
  })
  getComments(
    @Param('postId', ParseIntPipe) postId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
  ): Promise<PaginatedResponseDto<CommentListItemDto>> {
    return this.commentsService.getPagedCommentsFlat(postId, page);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('like/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '댓글 좋아요 토글' })
  @ApiResponse({
    status: 200,
    description: COMMENT_MESSAGES.LIKE_TOGGLED,
    schema: { example: { likes: 5 } },
  })
  @ApiResponse({ status: 404, description: COMMENT_ERRORS.NOT_FOUND })
  toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentsService.toggleLike(id, req.user);
  }
}
