// src/admin/category/admin-category.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as request from 'supertest';
import { AdminCategoryController } from '@/admin/category/admin-category.controller';
import { CategoriesService } from '@/categories/categories.service';
import { CreateCategoryDto } from '@/admin/category/dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from '@/admin/category/dto/CRUD/update-category.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { UserRole } from '@/users/entities/user-role.enum';
import { Category } from '@/categories/entities/category.entity';
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';
import { createBoard } from '@/boards/factories/board.factory';
import { CategorySummaryResponseDto } from '@/admin/category/dto/response/category-summary-response.dto';
import { createMock } from '@golevelup/ts-jest';
import { CATEGORY_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';
import { CategoryDetailsResponseDto } from './dto/response/category-details-response.dto';

describe('AdminCategoryController', () => {
  let app: INestApplication;
  let categoriesService: CategoriesService;

  const mockCategory: Category = createCategory({
    id: 1,
    name: 'Test Category',
    slugs: [createCategorySlug({ slug: 'test' })],
    boards: [createBoard({ id: 100 })],
  });

  const mockCategoryDto: CategorySummaryResponseDto = {
    id: 1,
    name: 'Test Category',
    allowedSlugs: ['test'],
    boardIds: [100],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCategoryController],
      providers: [
        {
          provide: CategoriesService,
          useValue: createMock<CategoriesService>({
            getAllCategoriesForAdmin: jest.fn(),
            isSlugUsed: jest.fn(),
            create: jest.fn().mockResolvedValue(mockCategoryDto),
            update: jest.fn().mockResolvedValue(mockCategoryDto),
            remove: jest.fn().mockResolvedValue(undefined),
            findOne: jest.fn().mockResolvedValue(mockCategory),
          }),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { role: UserRole.ADMIN };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    categoriesService = module.get<CategoriesService>(CategoriesService);
  });

  describe('GET /admin/categories', () => {
    const mockCategory = createCategory({
      id: 1,
      name: 'Technology',
      slugs: ['tech', 'innovation'].map((slug) => createCategorySlug({ slug })),
      boards: [
        createBoard({ id: 101, slug: 'ai', name: 'AI' }),
        createBoard({ id: 102, slug: 'data', name: 'Data Science' }),
      ],
    });

    const mockEmptyCategory = createCategory({
      id: 2,
      name: 'Sports',
      slugs: ['sports'].map((slug) => createCategorySlug({ slug })),
      boards: [],
    });

    const mockDtoResponse = [
      CategorySummaryResponseDto.fromEntity(mockCategory),
      CategorySummaryResponseDto.fromEntity(mockEmptyCategory),
    ];

    beforeEach(() => {
      (categoriesService.getAllCategoriesForAdmin as jest.Mock)
        .mockReset()
        .mockResolvedValue(mockDtoResponse);
    });

    it('200 OK - 모든 카테고리를 정상적으로 조회하고 DTO로 반환해야 함', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/categories')
        .expect(200);

      expect(res.body).toEqual([
        {
          id: 1,
          name: 'Technology',
          allowedSlugs: ['tech', 'innovation'],
          boardIds: [101, 102],
        },
        {
          id: 2,
          name: 'Sports',
          allowedSlugs: ['sports'],
          boardIds: [],
        },
      ]);
      expect(categoriesService.getAllCategoriesForAdmin).toHaveBeenCalled();
    });

    it('200 OK - 카테고리가 없는 경우 빈 배열을 반환해야 함', async () => {
      (
        categoriesService.getAllCategoriesForAdmin as jest.Mock
      ).mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/admin/categories')
        .expect(200);

      expect(res.body).toEqual([]);
      expect(categoriesService.getAllCategoriesForAdmin).toHaveBeenCalled();
    });
  });

  describe('GET /admin/categories/validate-slug', () => {
    const mockSlug = 'test-slug';

    it('should return { isUsed: false } if slug is not used', async () => {
      const categoryId = 1;
      (categoriesService.isSlugUsed as jest.Mock).mockResolvedValue(false);
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-slug`)
        .query({ slug: mockSlug, categoryId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsed: false });
      expect(categoriesService.isSlugUsed).toHaveBeenCalledWith(
        mockSlug,
        categoryId,
      );
    });

    it('should return { isUsed: true } if slug is used in other category', async () => {
      const categoryId = 1;
      (categoriesService.isSlugUsed as jest.Mock).mockResolvedValue(true);
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-slug`)
        .query({ slug: mockSlug, categoryId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsed: true });
      expect(categoriesService.isSlugUsed).toHaveBeenCalledWith(
        mockSlug,
        categoryId,
      );
    });

    it('should return { isUsed: false } when validating a new category (no categoryId)', async () => {
      (categoriesService.isSlugUsed as jest.Mock).mockResolvedValue(false);
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-slug`)
        .query({ slug: mockSlug });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsed: false });
      expect(categoriesService.isSlugUsed).toHaveBeenCalledWith(
        mockSlug,
        undefined,
      );
    });

    it('should return 400 if slug is empty', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-slug`)
        .query({ slug: '' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if slug is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        `/admin/categories/validate-slug`,
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /admin/categories/validate-name', () => {
    const mockName = 'Test Category';

    it('should return { isUsed: false } if name is not used', async () => {
      const categoryId = 1;
      (categoriesService.isNameUsed as jest.Mock).mockResolvedValue(false);
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-name`)
        .query({ name: mockName, categoryId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsed: false });
      expect(categoriesService.isNameUsed).toHaveBeenCalledWith(
        mockName,
        categoryId,
      );
    });

    it('should return { isUsed: true } if name is used in other category', async () => {
      const categoryId = 1;
      (categoriesService.isNameUsed as jest.Mock).mockResolvedValue(true);
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-name`)
        .query({ name: mockName, categoryId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsed: true });
      expect(categoriesService.isNameUsed).toHaveBeenCalledWith(
        mockName,
        categoryId,
      );
    });

    it('should return { isUsed: false } when validating a new category (no categoryId)', async () => {
      (categoriesService.isNameUsed as jest.Mock).mockResolvedValue(false);
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-name`)
        .query({ name: mockName });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsed: false });
      expect(categoriesService.isNameUsed).toHaveBeenCalledWith(
        mockName,
        undefined,
      );
    });

    it('should return 400 if name is empty', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/categories/validate-name`)
        .query({ name: '' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        `/admin/categories/validate-name`,
      );
      expect(res.status).toBe(400);
    });
  });

  describe('POST /admin/categories', () => {
    it('should create category', async () => {
      const dto: CreateCategoryDto = {
        name: 'New',
        allowedSlugs: ['new'],
      } satisfies CreateCategoryDto;

      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockCategoryDto);
      expect(categoriesService.create).toHaveBeenCalledWith(dto);
    });

    it('should return consistent error messages', async () => {
      const dto: CreateCategoryDto = {
        name: '',
        allowedSlugs: [],
      };

      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(400);

      expect(res.body.message).toContain(CATEGORY_ERROR_MESSAGES.NAME_REQUIRED);
      expect(res.body.message).toContain(
        CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
      );
    });

    it('should return 409 if category name already exists', async () => {
      const dto: CreateCategoryDto = {
        name: 'Existing Category',
        allowedSlugs: ['existing'],
      };

      jest.spyOn(categoriesService, 'create').mockImplementationOnce(() => {
        throw new ConflictException(
          CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
        );
      });

      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(409);

      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
      );
    });

    it('should return 400 if category slugs already exists', async () => {
      const dto: CreateCategoryDto = {
        name: 'Existing Category',
        allowedSlugs: ['duplicated', 'duplicated1'],
      };

      jest.spyOn(categoriesService, 'create').mockImplementationOnce(() => {
        throw new BadRequestException(
          CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(dto.allowedSlugs),
        );
      });

      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_SLUGS(dto.allowedSlugs),
      );
    });
  });

  describe('POST /admin/categories - invalid slugs', () => {
    const validDto: CreateCategoryDto = {
      name: 'Valid Category',
      allowedSlugs: ['valid-slug'],
    };

    it('should return 400 if slug contains uppercase', async () => {
      const dto = { ...validDto, allowedSlugs: ['InvalidSlug'] };
      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([CATEGORY_ERROR_MESSAGES.INVALID_SLUGS]);
    });

    it('should return 400 if slug contains special characters', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug@special'] };
      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([CATEGORY_ERROR_MESSAGES.INVALID_SLUGS]);
    });

    it('should return 400 if slug contains underscores', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug_with_underscore'] };
      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([CATEGORY_ERROR_MESSAGES.INVALID_SLUGS]);
    });
  });

  describe('GET /admin/categories/:id', () => {
    const categoryId = 1;
    const mockCategory = createCategory({
      id: categoryId,
      name: 'Technology',
      slugs: ['tech', 'innovation'].map((slug) => createCategorySlug({ slug })),
      boards: [
        createBoard({ id: 101, slug: 'ai', name: 'AI' }),
        createBoard({ id: 102, slug: 'data', name: 'Data Science' }),
      ],
    });
    const mockDtoResponse = CategoryDetailsResponseDto.fromEntity(mockCategory);

    beforeEach(() => {
      (categoriesService.getCategoryDetails as jest.Mock).mockReset();
    });

    it('200 OK - 카테고리 상세 정보를 정상적으로 조회하고 DTO로 반환해야 함', async () => {
      (categoriesService.getCategoryDetails as jest.Mock).mockResolvedValue(
        mockDtoResponse,
      );

      const res = await request(app.getHttpServer())
        .get(`/admin/categories/${categoryId}`)
        .expect(200);

      expect(res.body).toEqual({
        id: mockCategory.id,
        name: mockCategory.name,
        allowedSlugs: mockCategory.slugs.map((s) => s.slug),
        boards: mockCategory.boards.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          type: b.type,
          requiredRole: b.requiredRole,
        })),
        createdAt: mockCategory.createdAt.toISOString(),
        updatedAt: mockCategory.updatedAt.toISOString(),
      });
      expect(categoriesService.getCategoryDetails).toHaveBeenCalledWith(
        categoryId,
      );
    });

    it('404 Not Found - 존재하지 않는 카테고리 ID로 요청 시 에러 반환', async () => {
      (categoriesService.getCategoryDetails as jest.Mock).mockRejectedValue(
        new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND),
      );

      const res = await request(app.getHttpServer())
        .get(`/admin/categories/999`)
        .expect(404);

      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
      );
      expect(categoriesService.getCategoryDetails).toHaveBeenCalledWith(999);
    });
  });

  describe('PUT /admin/categories/:id', () => {
    it('should update category', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated',
        allowedSlugs: ['update-test'],
      };

      jest
        .spyOn(categoriesService, 'update')
        .mockResolvedValueOnce({ ...mockCategoryDto, ...dto });

      const res = await request(app.getHttpServer())
        .put('/admin/categories/1')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual({ ...mockCategoryDto, ...dto });
      expect(categoriesService.update).toHaveBeenCalledWith(1, dto);
    });

    it('should return consistent error messages', async () => {
      const dto: UpdateCategoryDto = {
        name: '',
        allowedSlugs: [],
      };

      const res = await request(app.getHttpServer())
        .put('/admin/categories/1')
        .send(dto)
        .expect(400);

      expect(res.body.message).toContain(CATEGORY_ERROR_MESSAGES.NAME_REQUIRED);
      expect(res.body.message).toContain(
        CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
      );
    });

    it('should return 409 if category name already exists', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Existing Category',
        allowedSlugs: ['test'],
      };

      jest.spyOn(categoriesService, 'update').mockImplementationOnce(() => {
        throw new ConflictException(
          CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
        );
      });

      const res = await request(app.getHttpServer())
        .put('/admin/categories/1')
        .send(dto)
        .expect(409);

      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
      );
    });

    it('should return 404 if category not found', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated',
        allowedSlugs: ['update-test'],
      };
      jest.spyOn(categoriesService, 'update').mockImplementationOnce(() => {
        throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      });

      const res = await request(app.getHttpServer())
        .put('/admin/categories/999')
        .send(dto)
        .expect(404);
      expect(res.status).toBe(404);
      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
      );
    });
  });

  describe('PUT /admin/categories/:id - invalid slugs', () => {
    const validDto: UpdateCategoryDto = {
      name: 'Updated Category',
      allowedSlugs: ['valid-slug'],
    };

    it('should return 400 if slug contains uppercase', async () => {
      const dto = { ...validDto, allowedSlugs: ['InvalidSlug'] };
      const res = await request(app.getHttpServer())
        .put('/admin/categories/1')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([CATEGORY_ERROR_MESSAGES.INVALID_SLUGS]);
    });

    it('should return 400 if slug contains special characters', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug@special'] };
      const res = await request(app.getHttpServer())
        .put('/admin/categories/1')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([CATEGORY_ERROR_MESSAGES.INVALID_SLUGS]);
    });

    it('should return 400 if slug contains underscores', async () => {
      const dto = { ...validDto, allowedSlugs: ['slug_with_underscore'] };
      const res = await request(app.getHttpServer())
        .put('/admin/categories/1')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([CATEGORY_ERROR_MESSAGES.INVALID_SLUGS]);
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('should delete category', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/admin/categories/1',
      );
      expect(res.status).toBe(204);
      expect(categoriesService.remove).toHaveBeenCalledWith(1);
    });

    it('should return 404 if category not found', async () => {
      jest.spyOn(categoriesService, 'remove').mockImplementationOnce(() => {
        throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      });

      const res = await request(app.getHttpServer()).delete(
        '/admin/categories/999',
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
      );
    });
  });
});
