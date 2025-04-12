import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { DeletePostResultDto } from './dto/delete-result.dto';
import { FindRecentPostsDto } from './dto/find-recent.dto';
import { ApiParam } from '@nestjs/swagger';
import { PostResponseDto } from './dto/post-response.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // 게시글 생성
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createPostDto: CreatePostDto,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user; // 인증된 사용자 정보
    return await this.postsService.create(createPostDto, user);
  }

  // 모든 게시글 조회
  @Get()
  async findAll() {
    return await this.postsService.findAll();
  }

  // 최근 게시물 조회
  @UsePipes(new ValidationPipe({ transform: true }))
  @Get('recent')
  async findRecent(@Query() query: FindRecentPostsDto) {
    const { boardIds = [1], limit = 5 } = query;
    return this.postsService.findRecentPosts(boardIds, limit);
  }

  // 특정 사용자가 작성한 게시글 조회
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: number) {
    return await this.postsService.findByUser(userId);
  }

  // 특정 게시글 조회
  @Get(':id')
  @ApiParam({ name: 'id', type: Number, description: '게시물 ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostResponseDto> {
    return await this.postsService.findOne(id);
  }

  // 게시글 수정
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: number,
    @Body() updatePostDto: UpdatePostDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.postsService.update(id, updatePostDto, req.user);
  }

  // 게시글 삭제
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id') id: number,
    @Req() req: RequestWithUser,
  ): Promise<DeletePostResultDto> {
    await this.postsService.delete(id, req.user);
    return { message: 'Post deleted successfully.' };
  }

  // 보드별 게시물 조회
  @Get('board/:boardId')
  async findByBoard(@Param('boardId') boardId: number) {
    return this.postsService.findPostsByBoardId(boardId);
  }
}
