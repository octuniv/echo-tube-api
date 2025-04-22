import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Post, PostOrigin } from './entities/post.entity';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { PostResponseDto } from './dto/post-response.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CategoriesService } from '@/categories/categories.service';
import { BoardsService } from '@/boards/boards.service';
import { UserRole } from '@/users/entities/user-role.enum';
import { CreateScrapedVideoDto } from '@/video-harvester/dto/create-scraped-video.dto';
import { BoardPurpose } from '@/boards/entities/board.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly boardsService: BoardsService,
    private readonly categoriesService: CategoriesService,
  ) {}

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

  private checkRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const hierarchy = [UserRole.USER, UserRole.BOT, UserRole.ADMIN];
    return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
  }

  // 게시글 생성
  async create(
    createPostDto: CreatePostDto,
    user: User,
  ): Promise<PostResponseDto> {
    const { title, content, boardSlug, videoUrl } = createPostDto;
    const board = await this.boardsService.findOne(boardSlug);
    await this.categoriesService.validateSlug(board.category.name, board.slug);

    if (!this.checkRole(user.role, board.requiredRole)) {
      throw new UnauthorizedException('해당 게시판에 글쓰기 권한이 없습니다');
    }

    const newPost = this.postRepository.create({
      title,
      content,
      videoUrl,
      board,
      createdBy: user,
      hotScore: this.calculateInitialHotScore(),
    });
    const savedPost = await this.postRepository.save(newPost);

    return PostResponseDto.fromEntity(savedPost);
  }

  // 모든 게시글 조회
  async findAll(): Promise<PostResponseDto[]> {
    const posts = await this.postRepository.find({
      relations: ['createdBy', 'board'],
    });
    return posts.map(PostResponseDto.fromEntity); // DTO로 변환
  }

  // 특정 사용자가 작성한 게시글 조회
  async findByUser(userId: number): Promise<PostResponseDto[]> {
    const posts = await this.postRepository.find({
      where: { createdBy: { id: userId } },
      relations: ['createdBy', 'board'],
    });
    return posts.map(PostResponseDto.fromEntity);
  }

  // 특정 게시글 조회, (내부용)
  async findById(id: number): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['createdBy', 'board'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  // 특정 ID로 게시물 조회
  async findOne(id: number): Promise<PostResponseDto> {
    const post = await this.findById(id);
    post.views += 1;
    await this.postRepository.save(post);
    return PostResponseDto.fromEntity(post);
  }

  async update(
    id: number,
    updatePostDto: UpdatePostDto,
    user: User,
  ): Promise<PostResponseDto> {
    const post = await this.findById(id);

    // 게시판 권한 검사
    if (!this.checkRole(user.role, post.board.requiredRole)) {
      throw new UnauthorizedException('해당 게시판 수정 권한이 없습니다');
    }

    // 소유자 또는 관리자 검사
    if (post.createdBy.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('수정 권한이 없습니다');
    }

    Object.assign(post, updatePostDto);
    const result = await this.postRepository.save(post);
    return PostResponseDto.fromEntity(result);
  }

  // 게시글 삭제
  async delete(id: number, user: User): Promise<void> {
    const post = await this.findById(id);

    // 게시판 권한 검사
    if (!this.checkRole(user.role, post.board.requiredRole)) {
      throw new UnauthorizedException('해당 게시판 삭제 권한이 없습니다');
    }

    // 소유자 또는 관리자 검사
    if (post.createdBy.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('삭제 권한이 없습니다');
    }

    const result = await this.postRepository.softDelete(id);
    if (result.affected !== 1) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  // 최근 게시물 조회
  async findRecentPosts(
    boardIds: number[] = [],
    limit: number = 10,
    excludedSlugs: string[] = [],
  ): Promise<PostResponseDto[]> {
    const query = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.board', 'board')
      .leftJoinAndSelect('post.createdBy', 'createdBy');

    // 제외할 슬러그 처리
    if (excludedSlugs.length > 0) {
      query.where('board.slug NOT IN (:...excludedSlugs)', { excludedSlugs });
    }

    // 게시판 ID 필터링
    if (boardIds.length > 0) {
      query.andWhere('board.id IN (:...boardIds)', { boardIds });
    }

    const posts = await query
      .orderBy('post.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return posts.map(PostResponseDto.fromEntity);
  }

  // 보드별 게시물 조회 (id)
  async findPostsByBoardId(boardId: number): Promise<PostResponseDto[]> {
    const posts = await this.postRepository.find({
      where: { board: { id: boardId } },
      relations: ['createdBy', 'board'],
    });
    return posts.map(PostResponseDto.fromEntity);
  }

  // 보드별 게시물 조회 (slug)
  async findPostsByBoardSlug(slug: string): Promise<PostResponseDto[]> {
    const posts = await this.postRepository.find({
      where: { board: { slug: slug } },
      relations: ['createdBy', 'board'],
    });
    return posts.map(PostResponseDto.fromEntity);
  }

  // 인기도 순 게시물 조회
  async findPopularPosts(
    excludedSlugs: string[] = [], // 제외할 슬러그 파라미터 추가
  ): Promise<PostResponseDto[]> {
    const query = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.board', 'board')
      .leftJoinAndSelect('post.createdBy', 'createdBy');

    // 제외할 슬러그가 있는 경우 조건 추가
    if (excludedSlugs.length > 0) {
      query.where('board.slug NOT IN (:...excludedSlugs)', {
        excludedSlugs,
      });
    }

    const popularPosts = await query
      .orderBy('post.hotScore', 'DESC')
      .take(10)
      .getMany();
    return popularPosts.map(PostResponseDto.fromEntity);
  }

  // 일정 주기마다 스코어 업데이트
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateHotScores() {
    const posts = await this.postRepository.find();
    for (const post of posts) {
      post.hotScore = this.calculateHotScore(post);
      try {
        await this.postRepository.save(post);
      } catch (error) {
        console.error(`Failed to update post ${post.id}:`, error);
        throw new InternalServerErrorException();
      }
    }
  }

  async createScrapedPost(
    data: CreateScrapedVideoDto,
    boardSlug: string,
    systemUser: User,
  ): Promise<Post> {
    const board = await this.boardsService.findOne(boardSlug);

    // 게시판 타입 검증
    await this.boardsService.validateBoardType(
      boardSlug,
      BoardPurpose.EXTERNAL_VIDEO,
    );

    const newPost = this.postRepository.create({
      type: PostOrigin.SCRAPED,
      title: data.title,
      videoUrl: data.link,
      youtubeId: data.youtubeId,
      channelTitle: data.channelTitle,
      duration: data.duration,
      source: 'YouTube',
      board: board,
      createdBy: systemUser,
      hotScore: this.calculateInitialHotScore(),
    });

    return this.postRepository.save(newPost);
  }
}
