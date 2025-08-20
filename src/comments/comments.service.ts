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
import { IsNull, Repository } from 'typeorm';
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

    const [topLevelComments, totalTopLevelCount] =
      await this.commentRepository.findAndCount({
        withDeleted: true,
        where: { post: { id: postId }, parent: IsNull() },
        order: { createdAt: 'DESC' },
        skip,
        take: threadsPerPage,
        relations: {
          createdBy: true,
          children: {
            parent: true,
            createdBy: true,
          },
        },
      });

    const allComments: CommentListItemDto[] = [];
    for (const comment of topLevelComments) {
      allComments.push(CommentListItemDto.fromEntity(comment));

      if (comment.children && comment.children.length > 0) {
        const sortedChildren = [...comment.children].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );

        for (const child of sortedChildren) {
          allComments.push(CommentListItemDto.fromEntity(child));
        }
      }
    }

    return {
      data: allComments,
      currentPage: validPage,
      totalItems: totalTopLevelCount,
      totalPages: Math.ceil(totalTopLevelCount / threadsPerPage),
    };
  }

  @Transactional()
  async likeComment(commentId: number, user: User): Promise<{ likes: number }> {
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
      return { likes: comment.likes };
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

    return { likes: comment.likes };
  }
}
