// src/categories/categories.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { createMock } from '@golevelup/ts-jest';
import { BoardPurpose } from '@/boards/entities/board.entity';

describe('CategoriesController', () => {
  let app: INestApplication;
  let categoriesService: CategoriesService;

  const mockCategories = [
    {
      name: '공지사항',
      allowedSlugs: ['announcements', 'notices'],
    },
    {
      name: '커뮤니티',
      allowedSlugs: ['free', 'humor', 'qna'],
    },
  ];

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: createMock<CategoriesService>({
            getAllCategoriesWithSlugs: jest
              .fn()
              .mockResolvedValue(mockCategories),
          }),
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    categoriesService = moduleRef.get<CategoriesService>(CategoriesService);
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /categories', () => {
    it('모든 카테고리와 슬러그 목록을 반환해야 함', async () => {
      const response = await request(app.getHttpServer()).get('/categories');

      expect(categoriesService.getAllCategoriesWithSlugs).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCategories);
    });

    it('카테고리가 없을 경우 빈 배열을 반환해야 함', async () => {
      jest
        .spyOn(categoriesService, 'getAllCategoriesWithSlugs')
        .mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /categories/with-boards', () => {
    const mockCategoryWithBoards = [
      {
        name: '공지사항',
        boardGroups: [
          {
            purpose: BoardPurpose.GENERAL,
            boards: [
              { id: 1, slug: 'notice-board', name: '공지게시판' },
              { id: 2, slug: 'event-board', name: '이벤트게시판' },
            ],
          },
          {
            purpose: BoardPurpose.AI_DIGEST,
            boards: [{ id: 3, slug: 'faq-board', name: '자주묻는질문' }],
          },
        ],
      },
    ];

    it('카테고리와 보드 그룹을 성공적으로 반환해야 함', async () => {
      // Mock 설정
      jest
        .spyOn(categoriesService, 'getCategoriesWithBoards')
        .mockResolvedValue(mockCategoryWithBoards as any);

      const response = await request(app.getHttpServer()).get(
        '/categories/with-boards',
      );

      expect(categoriesService.getCategoriesWithBoards).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCategoryWithBoards);
    });
  });
});
