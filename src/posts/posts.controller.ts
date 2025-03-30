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
  ParseArrayPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequestWithUser } from '@/auth/types/request-with-user.interface';
import { UserRole } from '@/users/entities/user-role.enum';
import { DeletePostResultDto } from './dto/delete-result.dto';

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

  // 특정 사용자가 작성한 게시글 조회
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: number) {
    return await this.postsService.findByUser(userId);
  }

  // 특정 게시글 조회
  @Get(':id')
  async findOne(@Param('id') id: number) {
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
    const isAdmin = req.user.role === UserRole.ADMIN;
    const userId = req.user.id;

    return await this.postsService.update(id, updatePostDto, userId, isAdmin);
  }

  // 게시글 삭제
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id') id: number,
    @Req() req: RequestWithUser,
  ): Promise<DeletePostResultDto> {
    const isAdmin = req.user.role === UserRole.ADMIN;
    try {
      await this.postsService.delete(id, req.user.id, isAdmin);
    } catch (error) {
      throw error;
    }
    return {
      message: 'Post deleted successfully.',
    };
  }

  // 최근 게시물 조회회
  @Get('recent')
  async findRecent(
    @Query('boardIds', ParseArrayPipe) boardIds: number[] = [1],
    @Query('limit', new DefaultValuePipe(5)) limit: number,
  ) {
    return this.postsService.findRecentPosts(boardIds, limit);
  }

  // 보드별 게시물 조회
  @Get('board/:boardId')
  async findByBoard(@Param('boardId') boardId: number) {
    return this.postsService.findByBoard(boardId);
  }
}
