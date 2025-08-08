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
import { In, Repository } from 'typeorm';
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
import { CommentFlatDto } from './dto/comment-flat.dto';
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
      where: { id, createdBy: { id: user.id } },
      relations: ['post'],
    });

    if (!comment) {
      throw new NotFoundException(COMMENT_ERRORS.NOT_FOUND);
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

    await this.postsService.decrementCommentCount(comment.post.id);
    const result = await this.commentRepository.softDelete(id);
    if (result.affected !== 1) {
      throw new InternalServerErrorException(
        '댓글 삭제 중 문제가 발생했습니다.',
      );
    }
    return { message: COMMENT_MESSAGES.DELETED, id };
  }

  async getPagedCommentsFlat(
    postId: number,
    page: number = 1,
  ): Promise<PaginatedResponseDto<CommentFlatDto>> {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [allComments, totalItems] = await this.commentRepository.findAndCount(
      {
        where: { post: { id: postId } },
        relations: ['createdBy', 'parent', 'children'],
        skip,
        take: limit,
      },
    );

    const currentPageCommentIds = new Set(
      allComments.map((comment) => comment.id),
    );
    const missingParentComments: Comment[] = [];
    const missingParentIds = new Set<number>();

    for (const comment of allComments) {
      if (
        comment.parent &&
        !currentPageCommentIds.has(comment.parent.id) &&
        !missingParentIds.has(comment.parent.id)
      ) {
        missingParentIds.add(comment.parent.id);
      }
    }

    if (missingParentIds.size > 0) {
      const additionalParents = await this.commentRepository.find({
        where: {
          id: In([...missingParentIds]),
        },
        relations: ['createdBy', 'children'],
      });
      missingParentComments.push(...additionalParents);
    }

    const responseData = [...allComments, ...missingParentComments].map(
      (comment) => {
        const dto = new CommentFlatDto();
        dto.id = comment.id;
        dto.content = comment.content;
        dto.likes = comment.likes;
        dto.createdAt = comment.createdAt;
        dto.updatedAt = comment.updatedAt;
        dto.nickname = comment.nickname;
        dto.parentId = comment.parent ? comment.parent.id : null;
        dto.hasReplies = comment.children && comment.children.length > 0;
        return dto;
      },
    );

    responseData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      data: responseData,
      currentPage: page,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    };
  }

  @Transactional()
  async toggleLike(commentId: number, user: User): Promise<{ likes: number }> {
    const comment = await this.commentRepository.findOne({
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
      await this.commentLikeRepository.delete({
        userId: user.id,
        commentId,
      });
      comment.likes = Math.max(0, comment.likes - 1);
    } else {
      await this.commentLikeRepository.save({
        userId: user.id,
        commentId,
      });
      comment.likes += 1;
    }

    await this.commentRepository.save(comment);
    return { likes: comment.likes };
  }
}
