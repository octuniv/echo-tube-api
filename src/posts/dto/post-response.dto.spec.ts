import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PostResponseDto } from './post-response.dto';
import { Post, PostOrigin } from '../entities/post.entity';
import { createBoard } from '@/boards/factories/board.factory';
import { BoardListItemDto } from '@/boards/dto/board-list-item.dto';
import { User } from '@/users/entities/user.entity';
import { createPost } from '../factories/post.factory';

describe('PostResponseDto', () => {
  describe('Validation', () => {
    it('should validate all required fields', async () => {
      const dto = plainToInstance(PostResponseDto, {
        id: 'invalid-number', // 유효하지 않은 타입
        title: 123, // 유효하지 않은 타입
        content: true, // 유효하지 않은 타입
        views: '100', // 유효하지 않은 타입
        commentsCount: '5', // 유효하지 않은 타입
        videoUrl: 'not-url', // 유효하지 않은 URL
        createdAt: 'invalid-date', // 유효하지 않은 날짜
        updatedAt: 'invalid-date',
        board: {}, // 유효하지 않은 board 객체
        hotScore: 'hot', // 유효하지 않은 숫자
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(10); // 모든 필드 오류 확인
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'id' }),
          expect.objectContaining({ property: 'title' }),
          expect.objectContaining({ property: 'content' }),
          expect.objectContaining({ property: 'views' }),
          expect.objectContaining({ property: 'commentsCount' }),
          expect.objectContaining({ property: 'videoUrl' }),
          expect.objectContaining({ property: 'createdAt' }),
          expect.objectContaining({ property: 'updatedAt' }),
          expect.objectContaining({ property: 'board' }),
          expect.objectContaining({ property: 'hotScore' }),
        ]),
      );
    });

    it('should validate nested board object', async () => {
      const dto = plainToInstance(PostResponseDto, {
        id: 1,
        title: 'Valid Title',
        content: 'Valid Content',
        views: 10,
        commentsCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        board: {
          invalidField: 'test',
        },
        hotScore: 150,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('board');
      expect(errors[0].children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'id' }),
          expect.objectContaining({ property: 'slug' }),
          expect.objectContaining({ property: 'name' }),
        ]),
      );
    });

    it('should validate optional fields', async () => {
      const dto = plainToInstance(PostResponseDto, {
        id: 1,
        title: 'Valid Title',
        content: 'Valid Content',
        views: 10,
        commentsCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        board: BoardListItemDto.fromEntity(
          createBoard({
            id: 1,
            slug: 'general',
            name: 'General',
          }),
        ),
        hotScore: 150,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0); // nickname과 videoUrl은 선택적 필드
    });
  });

  describe('fromEntity', () => {
    it('should convert Post entity to DTO correctly', () => {
      const post = new Post();
      const board = createBoard({
        id: 1,
        slug: 'general',
        name: 'General',
        description: 'General Board',
        category: null,
        posts: [],
      });
      const mockUser = {
        nickname: 'UserA',
      } as User;

      post.id = 1;
      post.title = 'Test Post';
      post.content = 'Test Content';
      post.views = 10;
      post.commentsCount = 5;
      post.videoUrl = 'https://example.com/video';
      post.createdBy = mockUser;
      post.createdAt = new Date('2023-10-01');
      post.updatedAt = new Date('2023-10-02');
      post.board = board;
      post.hotScore = 150.5;

      post.setNickname();

      const dto = PostResponseDto.fromEntity(post);
      expect(dto).toEqual({
        id: 1,
        title: 'Test Post',
        content: 'Test Content',
        views: 10,
        commentsCount: 5,
        videoUrl: 'https://example.com/video',
        nickname: 'UserA',
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        board: BoardListItemDto.fromEntity(board),
        hotScore: 150.5,
      });
    });

    it('should handle optional fields correctly', () => {
      const post = new Post();
      const board = createBoard({
        id: 1,
        slug: 'general',
        name: 'General',
      });
      post.id = 1;
      post.title = 'Test Post';
      post.content = 'Test Content';
      post.views = 10;
      post.commentsCount = 5;
      post.createdAt = new Date('2023-10-01');
      post.updatedAt = new Date('2023-10-02');
      post.board = board;
      post.hotScore = 0;

      const dto = PostResponseDto.fromEntity(post);
      expect(dto).toEqual({
        id: 1,
        title: 'Test Post',
        content: 'Test Content',
        views: 10,
        commentsCount: 5,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        board: BoardListItemDto.fromEntity(board),
        hotScore: 0,
      });
      expect(dto.videoUrl).toBeUndefined();
      expect(dto.nickname).toBeUndefined();
    });
  });

  it('should include scraped video fields', () => {
    const post = createPost({
      type: PostOrigin.SCRAPED,
      youtubeId: 'test123',
      channelTitle: 'Test Channel',
      duration: 'PT10M',
    });

    const dto = PostResponseDto.fromEntity(post);
    expect(dto.type).toBe(PostOrigin.SCRAPED);
    expect(dto.youtubeId).toBe('test123');
    expect(dto.channelTitle).toBe('Test Channel');
    expect(dto.duration).toBe('PT10M');
  });
});
