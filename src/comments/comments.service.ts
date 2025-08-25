import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/commentLike.entity';
import { Transactional } from 'typeorm-transactional';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { CommentResponseDto } from './dto/comment-response.dto';
import {
  COMMENT_ERRORS,
  COMMENT_MESSAGES,
} from './constants/comment.constants';
import { CommentListItemDto } from './dto/comment-list-item.dto';
import { PostsService } from '@/posts/posts.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(CommentLike)
    private commentLikeRepository: Repository<CommentLike>,
    private postsService: PostsService,
  ) {}

  @Transactional()
  async create(
    createCommentDto: CreateCommentDto,
    user: User,
  ): Promise<CommentResponseDto> {
    const { content, postId, parentId } = createCommentDto;
    const post = await this.postsService.findById(postId);
    if (!post) {
      throw new NotFoundException(COMMENT_ERRORS.POST_NOT_FOUND);
    }

    let parentComment: Comment | null = null;
    if (parentId) {
      parentComment = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ['parent'],
      });

      if (!parentComment) {
        throw new NotFoundException(COMMENT_ERRORS.PARENT_NOT_FOUND);
      }

      if (parentComment.parent) {
        throw new BadRequestException(COMMENT_ERRORS.MAX_DEPTH_EXCEEDED);
      }
    }

    const comment = this.commentRepository.create({
      content,
      post,
      createdBy: user,
      parent: parentComment,
    });

    await this.postsService.incrementCommentCount(postId);
    const result = await this.commentRepository.save(comment);
    return { message: COMMENT_MESSAGES.CREATED, id: result.id };
  }

  async update(
    id: number,
    updateCommentDto: UpdateCommentDto,
    user: User,
  ): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!comment) {
      throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
    }

    if (comment.createdBy.id !== user.id) {
      throw new ForbiddenException(COMMENT_ERRORS.NO_PERMISSION);
    }

    comment.content = updateCommentDto.content;
    const result = await this.commentRepository.save(comment);
    return { message: COMMENT_MESSAGES.UPDATED, id: result.id };
  }

  @Transactional()
  async remove(id: number, user: User): Promise<CommentResponseDto> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['post', 'createdBy'],
    });

    if (!comment) {
      throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
    }

    if (user.role !== UserRole.ADMIN && comment.createdBy.id !== user.id) {
      throw new ForbiddenException(COMMENT_ERRORS.NO_PERMISSION);
    }

    await this.postsService.decrementCommentCountBulk(comment.post.id, 1);
    const result = await this.commentRepository.softDelete({
      id,
    });

    if (result.affected !== 1) {
      throw new InternalServerErrorException(
        `댓글 삭제 중 문제가 발생했습니다.`,
      );
    }

    return { message: COMMENT_MESSAGES.DELETED, id };
  }

  async getPagedCommentsFlat(
    postId: number,
    page: number = 1,
  ): Promise<PaginatedResponseDto<CommentListItemDto>> {
    const threadsPerPage = 10;
    const validPage = Math.max(1, page);
    const skip = (validPage - 1) * threadsPerPage;

    // 1. 가시성 조건을 만족하는 부모 댓글 수 계산
    const totalVisibleCount = await this.commentRepository
      .createQueryBuilder('comment')
      .where('comment.post_id = :postId', { postId })
      .andWhere('comment.parent_id IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('comment.deleted_at IS NULL').orWhere(
            'EXISTS (SELECT 1 FROM comment c2 WHERE c2.parent_id = comment.id AND c2.deleted_at IS NULL AND c2.post_id = :subPostId)',
            { subPostId: postId },
          );
        }),
      )
      .withDeleted()
      .getCount();

    const totalPages = Math.ceil(totalVisibleCount / threadsPerPage);

    // 2. 최상위 부모 댓글 ID만 조회 (데이터가 아닌 ID만)
    const topLevelCommentIds = await this.commentRepository
      .createQueryBuilder('comment')
      .select('comment.id')
      .where('comment.post_id = :postId', { postId })
      .andWhere('comment.parent_id IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('comment.deleted_at IS NULL').orWhere(
            'EXISTS (SELECT 1 FROM comment c2 WHERE c2.parent_id = comment.id AND c2.deleted_at IS NULL AND c2.post_id = :subPostId)',
            { subPostId: postId },
          );
        }),
      )
      .withDeleted()
      .orderBy('comment.created_at', 'DESC')
      .skip(skip)
      .take(threadsPerPage)
      .getMany()
      .then((comments) => comments.map((c) => c.id));

    // 3. 부모 댓글 ID 추출
    const parentIds = topLevelCommentIds;
    if (parentIds.length === 0) {
      return {
        data: [],
        currentPage: validPage,
        totalItems: totalVisibleCount,
        totalPages: totalPages,
      };
    }

    // 4. 부모 댓글의 비삭제 자식 댓글만 한 번에 조회
    const childComments = await this.commentRepository
      .createQueryBuilder('comment')
      .select([
        'comment.id',
        'comment.content',
        'comment.likes',
        'comment.createdAt',
        'comment.updatedAt',
        'comment.deletedAt',
        'comment.parentId',
        'createdBy.nickname',
      ])
      .leftJoinAndSelect('comment.createdBy', 'createdBy')
      .where('comment.parentId IN (:...parentIds)', { parentIds })
      .andWhere('comment.deletedAt IS NULL')
      .orderBy('comment.createdAt', 'ASC')
      .getMany();

    // 5. childrenMap 생성
    const childrenMap = new Map<number, Comment[]>();
    childComments.forEach((child) => {
      if (child.parentId !== null && parentIds.includes(child.parentId)) {
        if (!childrenMap.has(child.parentId)) {
          childrenMap.set(child.parentId, []);
        }
        childrenMap.get(child.parentId).push(child);
      }
    });

    // 6. 부모 댓글 전체 조회 (삭제된 댓글 포함)
    const parentCommentsWithDetails = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.createdBy', 'createdBy')
      .where('comment.id IN (:...ids)', { ids: parentIds })
      .withDeleted()
      .orderBy('comment.created_at', 'DESC')
      .getMany();

    // 7. 최종 결과 생성 - parentCommentsWithDetails 직접 사용
    const allComments: CommentListItemDto[] = [];
    parentCommentsWithDetails.forEach((comment) => {
      // 부모 댓글 추가
      const dto = CommentListItemDto.fromEntity(comment);
      dto.hasReplies =
        childrenMap.has(comment.id) && childrenMap.get(comment.id)?.length > 0;
      allComments.push(dto);

      // 자식 댓글 추가
      if (childrenMap.has(comment.id)) {
        childrenMap.get(comment.id).forEach((child) => {
          if (child) {
            allComments.push(CommentListItemDto.fromEntity(child));
          }
        });
      }
    });

    return {
      data: allComments,
      currentPage: validPage,
      totalItems: totalVisibleCount,
      totalPages: totalPages,
    };
  }

  @Transactional()
  async likeComment(
    commentId: number,
    user: User,
  ): Promise<{ likes: number; isAdded: boolean }> {
    let comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
    }

    const existingLike = await this.commentLikeRepository.findOne({
      where: {
        userId: user.id,
        commentId,
      },
    });

    if (existingLike) {
      return { likes: comment.likes, isAdded: false };
    } else {
      await this.commentLikeRepository.save({
        userId: user.id,
        commentId,
      });

      await this.commentRepository
        .createQueryBuilder()
        .update(Comment)
        .set({ likes: () => 'likes + 1' })
        .where('id = :id', { id: commentId })
        .execute();
    }

    comment = await this.commentRepository.findOne({
      where: { id: commentId },
      select: ['likes'],
    });

    return { likes: comment.likes, isAdded: true };
  }
}
