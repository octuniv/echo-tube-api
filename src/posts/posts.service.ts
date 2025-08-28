import {
  forwardRef,
  Inject,
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
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { CommentsService } from '@/comments/comments.service';
import { Transactional } from 'typeorm-transactional';
import { PostLike } from './entities/post-like.entity';
import { LikeResponseDto } from './dto/like-response.dto';
import { POST_ERROR_MESSAGES } from './constants/error-messages.constants';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostLike)
    private readonly postLikeRepository: Repository<PostLike>,
    @Inject(forwardRef(() => CommentsService))
    private readonly commentsService: CommentsService,
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
      post.commentsCount * 2 +
      post.likesCount * 3 +
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
    const board = await this.boardsService.findOneBySlug(boardSlug);
    await this.categoriesService.verifySlugBelongsToCategory(
      board.category.name,
      board.categorySlug.slug,
    );

    if (!this.checkRole(user.role, board.requiredRole)) {
      throw new UnauthorizedException(
        POST_ERROR_MESSAGES.POST_CREATE_BOARD_PERMISSION_DENIED,
      );
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
      relations: {
        createdBy: true,
        board: {
          categorySlug: true,
        },
      },
    });
    return posts.map(PostResponseDto.fromEntity); // DTO로 변환
  }

  // 특정 사용자가 작성한 게시글 조회
  async findByUser(userId: number): Promise<PostResponseDto[]> {
    const posts = await this.postRepository.find({
      where: { createdBy: { id: userId } },
      relations: {
        createdBy: true,
        board: {
          categorySlug: true,
        },
      },
    });
    return posts.map(PostResponseDto.fromEntity);
  }

  // 특정 게시글 조회, (내부용)
  async findById(id: number): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: {
        createdBy: true,
        board: {
          categorySlug: true,
        },
      },
    });
    if (!post)
      throw new NotFoundException(POST_ERROR_MESSAGES.POST_FIND_NOT_FOUND);
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
      throw new UnauthorizedException(
        POST_ERROR_MESSAGES.POST_UPDATE_BOARD_PERMISSION_DENIED,
      );
    }

    // 소유자 또는 관리자 검사
    if (post.createdBy.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException(
        POST_ERROR_MESSAGES.POST_UPDATE_OWNERSHIP_PERMISSION_DENIED,
      );
    }

    Object.assign(post, updatePostDto);
    const result = await this.postRepository.save(post);
    return PostResponseDto.fromEntity(result);
  }

  // 게시글 삭제
  @Transactional()
  async delete(id: number, user: User): Promise<void> {
    const post = await this.findById(id);

    // 게시판 권한 검사
    if (!this.checkRole(user.role, post.board.requiredRole)) {
      throw new UnauthorizedException(
        POST_ERROR_MESSAGES.POST_DELETE_BOARD_PERMISSION_DENIED,
      );
    }

    // 소유자 또는 관리자 검사
    if (post.createdBy.id !== user.id && user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException(
        POST_ERROR_MESSAGES.POST_DELETE_OWNERSHIP_PERMISSION_DENIED,
      );
    }

    await this.commentsService.softDeletePostComments(id);

    const result = await this.postRepository.softDelete(id);
    if (result.affected !== 1) {
      throw new InternalServerErrorException(
        POST_ERROR_MESSAGES.POST_DELETE_FAILED,
      );
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
      .leftJoinAndSelect('board.categorySlug', 'categorySlug')
      .leftJoinAndSelect('post.createdBy', 'createdBy');

    // 제외할 슬러그 처리
    if (excludedSlugs.length > 0) {
      query.where('categorySlug.slug NOT IN (:...excludedSlugs)', {
        excludedSlugs,
      });
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
  async findPostsByBoardId(
    boardId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<PostResponseDto>> {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'DESC',
    } = paginationDto;

    const skip = (page - 1) * limit;

    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.createdBy', 'createdBy')
      .leftJoinAndSelect('post.board', 'board')
      .leftJoinAndSelect('board.categorySlug', 'categorySlug')
      .where('post.board.id = :boardId', { boardId });

    if (sort === 'createdAt' || sort === 'updatedAt') {
      queryBuilder.orderBy(`post.${sort}`, order);
    } else {
      queryBuilder.orderBy('post.createdAt', 'DESC');
    }

    const [posts, totalItems] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const data = posts.map(PostResponseDto.fromEntity);

    return {
      data,
      currentPage: page,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }

  // 보드별 게시물 조회 (slug)
  async findRecentPostsByBoardSlug(
    slug: string,
    limit?: number,
  ): Promise<PostResponseDto[]> {
    const query = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.createdBy', 'createdBy')
      .leftJoinAndSelect('post.board', 'board')
      .leftJoinAndSelect('board.categorySlug', 'categorySlug')
      .where('categorySlug.slug = :slug', { slug })
      .orderBy('post.createdAt', 'DESC'); // 최신 순 정렬 추가

    if (limit) {
      query.take(limit);
    }

    const posts = await query.getMany();
    return posts.map(PostResponseDto.fromEntity);
  }

  // 인기도 순 게시물 조회
  async findPopularPosts(
    excludedSlugs: string[] = [], // 제외할 슬러그 파라미터 추가
  ): Promise<PostResponseDto[]> {
    const query = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.board', 'board')
      .leftJoinAndSelect('board.categorySlug', 'categorySlug')
      .leftJoinAndSelect('post.createdBy', 'createdBy');

    // 제외할 슬러그가 있는 경우 조건 추가
    if (excludedSlugs.length > 0) {
      query.where('categorySlug.slug NOT IN (:...excludedSlugs)', {
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
    const updatePromises = posts.map(async (post) => {
      post.hotScore = this.calculateHotScore(post);
      return this.postRepository.save(post);
    });

    await Promise.all(updatePromises);
  }

  async createScrapedPost(
    data: CreateScrapedVideoDto,
    boardSlug: string,
    user: User,
  ): Promise<Post> {
    const board = await this.boardsService.findOneBySlug(boardSlug);

    // 게시판 타입 검증
    await this.boardsService.validateBoardType(
      boardSlug,
      BoardPurpose.AI_DIGEST,
    );

    const newPost = this.postRepository.create({
      type: PostOrigin.SCRAPED,
      title: data.title,
      content: '',
      videoUrl: `https://www.youtube.com/watch?v=${data.youtubeId}`,
      channelTitle: data.channelTitle,
      duration: data.duration,
      source: 'YouTube',
      board: board,
      createdBy: user,
      hotScore: this.calculateInitialHotScore(),
    });

    return this.postRepository.save(newPost);
  }

  // 댓글 수 증가 메서드
  async incrementCommentCount(postId: number): Promise<void> {
    await this.postRepository.increment({ id: postId }, 'commentsCount', 1);
  }

  // 댓글 수 감소 메서드 (0 미만으로 내려가지 않도록 보장)
  async decrementCommentCountBulk(
    postId: number,
    count: number,
  ): Promise<void> {
    if (count <= 0) return;

    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(
        POST_ERROR_MESSAGES.POST_FIND_NOT_FOUND_BY_ID(postId.toString()),
      );
    }

    await this.postRepository
      .createQueryBuilder()
      .update(Post)
      .set({ commentsCount: () => `GREATEST(commentsCount - ${count}, 0)` }) // 음수 방지
      .where('id = :id', { id: postId })
      .execute();
  }

  @Transactional()
  async likePost(postId: number, user: User): Promise<LikeResponseDto> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(POST_ERROR_MESSAGES.POST_FIND_NOT_FOUND);
    }

    // 이미 좋아요한지 확인
    const existingLike = await this.postLikeRepository.findOne({
      where: {
        userId: user.id,
        postId,
      },
    });

    let isAdded = false;

    if (existingLike) {
      // 이미 좋아요한 경우 무시하고 현재 좋아요 수 반환
      return {
        postId: post.id,
        likesCount: post.likesCount,
        isAdded: false,
      };
    } else {
      // 좋아요 추가
      await this.postLikeRepository.save({
        userId: user.id,
        postId,
      });

      // likesCount 직접 증가
      await this.postRepository
        .createQueryBuilder()
        .update(Post)
        .set({ likesCount: () => 'likesCount + 1' })
        .where('id = :id', { id: postId })
        .execute();

      isAdded = true;
    }

    // 최신 좋아요 수 조회
    const updatedPost = await this.postRepository.findOne({
      where: { id: postId },
      select: ['likesCount'],
    });

    return {
      postId: post.id,
      likesCount: updatedPost.likesCount,
      isAdded,
    };
  }
}
