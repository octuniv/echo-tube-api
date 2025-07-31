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
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { DeletePostResultDto } from './dto/delete-result.dto';
import { FindRecentPostsDto } from './dto/find-recent.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new post' })
  @ApiResponse({ status: 201, type: PostResponseDto })
  @UseGuards(JwtAuthGuard)
  async create(@Body() createPostDto: CreatePostDto, @Req() req: any) {
    return this.postsService.create(createPostDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posts' })
  @ApiResponse({ status: 200, type: [PostResponseDto] })
  async findAll() {
    return this.postsService.findAll();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent posts' })
  @ApiResponse({ status: 200, type: [PostResponseDto] })
  async findRecent(@Query() query: FindRecentPostsDto) {
    return this.postsService.findRecentPosts(query.boardIds, query.limit);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user posts' })
  @ApiResponse({ status: 200, type: [PostResponseDto] })
  async findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.postsService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post details' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update post' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @Req() req: any,
  ) {
    return this.postsService.update(id, updatePostDto, req.user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete post' })
  @ApiResponse({ status: 200, type: DeletePostResultDto })
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.postsService.delete(id, req.user);
    return { message: 'Post deleted successfully.' };
  }

  @Get('board/:boardId')
  @ApiOperation({ summary: 'Get posts by board ID (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved paginated posts by board ID.',
    type: PaginatedResponseDto<PostResponseDto>,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['createdAt', 'updatedAt'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  async findByBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<PostResponseDto>> {
    return this.postsService.findPostsByBoardId(boardId, paginationDto);
  }
}
