import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { In, Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { QueryPostDto } from './dto/query-post.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CategoriesService } from '@/categories/categories.service';
import { BoardsService } from '@/boards/boards.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly boardsService: BoardsService,
    private readonly categoriesService: CategoriesService,
  ) {}
  // 게시글 생성
  async create(
    createPostDto: CreatePostDto,
    user: User,
  ): Promise<QueryPostDto> {
    const board = await this.boardsService.findOne(createPostDto.boardId);
    await this.categoriesService.validateSlug(board.category.name, board.slug);

    const newPost = this.postRepository.create({
      ...createPostDto,
      board,
      createdBy: user,
      hotScore: this.calculateInitialHotScore(),
    });
    const savedPost = await this.postRepository.save(newPost);

    return QueryPostDto.fromEntity(savedPost);
  }

  private calculateInitialHotScore(): number {
    return Date.now() / 1000; // 기본값으로 현재 시간 사용
  }

  private calculateHotScore(post: Post): number {
    const HOUR = 1000 * 60 * 60;
    const age = Date.now() - post.createdAt.getTime();
    const ageInHours = age / HOUR;

    return (
      post.views * 1.5 +
      // (post.comments.length * 2 || 0) +
      // (post.likes?.length * 3 || 0) +
      (1 / Math.pow(ageInHours + 2, 1.5)) * 100 // 시간 감소 보정
    );
  }

  // 모든 게시글 조회
  async findAll(): Promise<QueryPostDto[]> {
    const posts = await this.postRepository.find({
      relations: ['createdBy'], // createdBy는 닉네임 계산을 위해 필요
    });
    return posts.map(QueryPostDto.fromEntity); // DTO로 변환
  }

  // 특정 사용자가 작성한 게시글 조회
  async findByUser(userId: number): Promise<QueryPostDto[]> {
    const posts = await this.postRepository.find({
      where: { createdBy: { id: userId } },
      relations: ['createdBy'],
    });
    return posts.map(QueryPostDto.fromEntity);
  }

  // 특정 게시글 조회, (query 전용)
  async findById(id: number): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  // 특정 ID로 게시물 조회
  async findOne(id: number): Promise<QueryPostDto> {
    const post = await this.findById(id);
    post.views += 1;
    await this.postRepository.save(post);
    return QueryPostDto.fromEntity(post);
  }

  async update(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
    isAdmin: boolean,
  ): Promise<QueryPostDto> {
    const post = await this.findById(id);

    if (post.createdBy.id !== userId && !isAdmin) {
      throw new UnauthorizedException(
        'You are not authorized to update this post',
      );
    }

    Object.assign(post, updatePostDto);
    const result = await this.postRepository.save(post);
    return QueryPostDto.fromEntity(result);
  }

  // 게시글 삭제
  async delete(id: number, userId: number, isAdmin: boolean): Promise<void> {
    const post = await this.findById(id);

    if (post.createdBy.id !== userId && !isAdmin) {
      throw new UnauthorizedException(
        'You are not authorized to delete this post',
      );
    }

    const result = await this.postRepository.softDelete(id);
    if (result.affected !== 1) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  // 최근 게시물 조회
  async findRecentPosts(
    boardIds: number[],
    limit: number = 10,
  ): Promise<QueryPostDto[]> {
    const posts = await this.postRepository.find({
      where: { board: { id: In(boardIds) } },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['board'],
    });
    return posts.map(QueryPostDto.fromEntity);
  }

  // 보드별 게시물 조회
  async findByBoard(boardId: number): Promise<QueryPostDto[]> {
    const posts = await this.postRepository.find({
      where: { board: { id: boardId } },
      relations: ['createdBy', 'board'],
    });
    return posts.map(QueryPostDto.fromEntity);
  }

  // 일정 주기마다 스코어 업데이트
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateHotScores() {
    const posts = await this.postRepository.find();
    for (const post of posts) {
      post.hotScore = this.calculateHotScore(post);
      await this.postRepository.save(post);
    }
  }
}
