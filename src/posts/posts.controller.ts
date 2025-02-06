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
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RequestWithUser } from '@/auth/types/request-with-user.interface';
import { UserRole } from '@/users/entities/user-role.enum';

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
  async delete(@Param('id') id: number, @Req() req: RequestWithUser) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    await this.postsService.delete(id, req.user.id, isAdmin);
    return { message: 'Post deleted successfully' };
  }
}
