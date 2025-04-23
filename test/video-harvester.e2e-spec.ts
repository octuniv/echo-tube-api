import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getAuthHeaders, setupTestApp } from './utils/test.util';
import { VideoFactory } from '@/video-harvester/factory/video.factory';
import { UserRole } from '@/users/entities/user-role.enum';
import { Board, BoardPurpose } from '@/boards/entities/board.entity';
import { Repository } from 'typeorm';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '@/posts/entities/post.entity';

describe('Video-harvester (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let access_token: string;
  let boardRepository: Repository<Board>;
  let externalBoard: Board;
  let postRepository: Repository<Post>;

  beforeAll(async () => {
    const testApp = await setupTestApp();

    ({ app, module } = testApp);

    boardRepository = module.get<Repository<Board>>(getRepositoryToken(Board));
    postRepository = module.get<Repository<Post>>(getRepositoryToken(Post));
  }, 15000);

  beforeAll(async () => {
    const bot_email = process.env.BOT_EMAIL;
    const bot_password = process.env.BOT_PASSWORD;
    expect(bot_email).toBeDefined();
    expect(bot_password).toBeDefined();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: bot_email,
        password: bot_password,
      })
      .expect(200);

    expect(loginResponse.body).toBeDefined();
    expect(loginResponse.body.user.role).toEqual(UserRole.BOT);
    access_token = loginResponse.body.access_token;
  });

  beforeAll(async () => {
    externalBoard = await boardRepository.findOneBy({
      type: BoardPurpose.EXTERNAL_VIDEO,
      slug: 'nestjs',
    });

    expect(externalBoard).toBeTruthy();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /harverst/videos', () => {
    const validDto = new VideoFactory().create();

    it('성공: BOT이 유효한 데이터로 게시물 생성', async () => {
      const res = await request(app.getHttpServer())
        .post('/harvest/videos')
        .set('Authorization', getAuthHeaders(access_token).Authorization)
        .query({ slug: externalBoard.slug })
        .send(validDto)
        .expect(201);

      // 응답 구조 검증
      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          title: validDto.title,
          videoUrl: `https://www.youtube.com/watch?v=${validDto.youtubeId}`,
        }),
      );

      // DB 검증
      const savedPost = await postRepository.findOne({
        where: { title: validDto.title },
        relations: ['board', 'createdBy'],
      });
      expect(savedPost).toBeDefined();
      expect(savedPost.board.id).toBe(externalBoard.id);
      expect(savedPost.createdBy.role).toBe(UserRole.BOT);
    });

    it('실패: 인증 없이 접근', async () => {
      await request(app.getHttpServer())
        .post('/harvest/videos')
        .query({ slug: externalBoard.slug })
        .send(validDto)
        .expect(401);
    });

    it('실패: 존재하지 않는 게시판', async () => {
      await request(app.getHttpServer())
        .post('/harvest/videos')
        .set('Authorization', getAuthHeaders(access_token).Authorization)
        .query({ slug: 'non-existent' })
        .send(validDto)
        .expect(404);
    });

    it('실패: GENERAL 타입 게시판 사용', async () => {
      const generalBoard = await boardRepository.findOneBy({
        type: BoardPurpose.GENERAL,
      });

      expect(generalBoard).toBeDefined();

      await request(app.getHttpServer())
        .post('/harvest/videos')
        .set('Authorization', getAuthHeaders(access_token).Authorization)
        .query({ slug: generalBoard.slug })
        .send(validDto)
        .expect(400);
    });

    it('실패: 유효하지 않은 DTO 데이터', async () => {
      const invalidDto = {
        ...validDto,
        youtubeId: '',
        thumbnailUrl: 'invalid-url',
      };
      const res = await request(app.getHttpServer())
        .post('/harvest/videos')
        .set('Authorization', getAuthHeaders(access_token).Authorization)
        .query({ slug: externalBoard.slug })
        .send(invalidDto)
        .expect(400);

      expect(res.body.message).toContain('youtubeId should not be empty');
      expect(res.body.message).toContain('thumbnailUrl must be a URL address');
    });
  });
});
