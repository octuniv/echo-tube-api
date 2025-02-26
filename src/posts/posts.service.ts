import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { QueryPostDto } from './dto/query-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}
  // 게시글 생성
  async create(createPostDto: CreatePostDto, user: User): Promise<Post> {
    const newPost = this.postRepository.create({
      ...createPostDto,
      createdBy: user,
    });
    return await this.postRepository.save(newPost);
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

  // 특정 ID로 게시물 조회
  async findById(id: number): Promise<Post> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  // 특정 게시글 조회, (query 전용)
  async findOne(id: number): Promise<QueryPostDto> {
    const post = await this.findById(id);
    return QueryPostDto.fromEntity(post);
  }

  async update(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
    isAdmin: boolean,
  ): Promise<Post> {
    const post = await this.findById(id);

    if (post.createdBy.id !== userId && !isAdmin) {
      throw new UnauthorizedException(
        'You are not authorized to update this post',
      );
    }

    Object.assign(post, updatePostDto);
    return await this.postRepository.save(post);
  }

  // 게시글 삭제
  async delete(id: number, userId: number, isAdmin: boolean): Promise<void> {
    const post = await this.findById(id);

    if (post.createdBy.id !== userId && !isAdmin) {
      throw new UnauthorizedException(
        'You are not authorized to delete this post',
      );
    }

    await this.postRepository.delete(id);
  }
}
