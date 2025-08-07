import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PostsService } from '../posts.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/commentLike.entity';
import { Transactional } from 'typeorm-transactional';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

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
  ): Promise<Comment> {
    const { content, postId, parentId } = createCommentDto;
    const post = await this.postsService.findById(postId);
    if (!post) {
      throw new NotFoundException('게시물을 찾을 수 없습니다.');
    }

    let parentComment: Comment | null = null;
    if (parentId) {
      parentComment = await this.commentRepository.findOne({
        where: { id: parentId },
        relations: ['parent'],
      });

      if (!parentComment) {
        throw new NotFoundException('부모 댓글을 찾을 수 없습니다.');
      }

      if (parentComment.parent) {
        throw new BadRequestException(
          '대댓글에 대한 답글은 작성할 수 없습니다. (최대 2단계 까지만 허용)',
        );
      }
    }

    const comment = this.commentRepository.create({
      content,
      post,
      createdBy: user,
      parent: parentComment,
    });

    await this.postsService.incrementCommentCount(postId);
    return this.commentRepository.save(comment);
  }

  async update(
    id: number,
    updateCommentDto: UpdateCommentDto,
    user: User,
  ): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id, createdBy: { id: user.id } },
      relations: ['post'],
    });

    if (!comment) {
      throw new NotFoundException(
        '댓글을 찾을 수 없거나 수정 권한이 없습니다.',
      );
    }

    comment.content = updateCommentDto.content;
    return this.commentRepository.save(comment);
  }

  @Transactional()
  async remove(id: number, user: User): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id, createdBy: { id: user.id } },
      relations: ['post'],
    });

    if (!comment) {
      throw new NotFoundException(
        '댓글을 찾을 수 없거나 삭제 권한이 없습니다.',
      );
    }

    await this.postsService.decrementCommentCount(comment.post.id);

    await this.commentRepository.softDelete(id);
  }

  async getPagedCommentsFlat(
    postId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Comment>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [allComments, totalItems] = await this.commentRepository.findAndCount(
      {
        where: {
          post: { id: postId },
        },
        relations: ['createdBy', 'parent'],
        order: { createdAt: 'ASC' },
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
        relations: ['createdBy'],
      });
      missingParentComments.push(...additionalParents);
    }

    const responseData = [...allComments, ...missingParentComments];

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
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
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
