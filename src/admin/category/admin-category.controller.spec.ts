// src/admin/category/admin-category.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as request from 'supertest';
import { AdminCategoryController } from '@/admin/category/admin-category.controller';
import { CategoriesService } from '@/categories/categories.service';
import { CreateCategoryDto } from '@/categories/dto/CRUD/create-category.dto';
import { UpdateCategoryDto } from '@/categories/dto/CRUD/update-category.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { UserRole } from '@/users/entities/user-role.enum';
import { Category } from '@/categories/entities/category.entity';
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';
import { createBoard } from '@/boards/factories/board.factory';
import { CategoryDetailsResponseDto } from '@/categories/dto/detail/category-details-response.dto';
import { createMock } from '@golevelup/ts-jest';
import { CATEGORY_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';

describe('AdminCategoryController', () => {
  let app: INestApplication;
  let categoriesService: CategoriesService;

  const mockCategory: Category = createCategory({
    id: 1,
    name: 'Test Category',
    slugs: [createCategorySlug({ slug: 'test' })],
    boards: [createBoard({ id: 100 })],
  });

  const mockCategories = [
    createCategory({
      name: '공지사항',
      slugs: ['announcements', 'notices'].map((slug) =>
        createCategorySlug({ slug }),
      ),
    }),
    createCategory({
      name: '커뮤니티',
      slugs: ['free', 'humor', 'qna'].map((slug) =>
        createCategorySlug({ slug }),
      ),
    }),
  ];

  const mockCategoryDto: CategoryDetailsResponseDto = {
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
            listAllCategoriesWithSlugs: jest
              .fn()
              .mockResolvedValue(mockCategories),
            isSlugUsedInOtherCategory: jest.fn(),
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
    it('should return list of categories', async () => {
      const res = await request(app.getHttpServer()).get('/admin/categories');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCategories);
      expect(categoriesService.listAllCategoriesWithSlugs).toHaveBeenCalled();
    });
  });

  describe('GET /admin/categories/:id/validate-slug', () => {
    const categoryId = 1;
    const mockSlug = 'test-slug';

    it('should return { isUsedInOtherCategory: false } if slug is not used', async () => {
      (
        categoriesService.isSlugUsedInOtherCategory as jest.Mock
      ).mockResolvedValue(false);
      const res = await request(app.getHttpServer()).get(
        `/admin/categories/${categoryId}/validate-slug?slug=${mockSlug}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsedInOtherCategory: false });
    });

    it('should return { isUsedInOtherCategory: true } if slug is used in other category', async () => {
      (
        categoriesService.isSlugUsedInOtherCategory as jest.Mock
      ).mockResolvedValue(true);
      const res = await request(app.getHttpServer()).get(
        `/admin/categories/${categoryId}/validate-slug?slug=${mockSlug}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ isUsedInOtherCategory: true });
    });

    it('should return 400 if slug is empty', async () => {
      const res = await request(app.getHttpServer()).get(
        `/admin/categories/${categoryId}/validate-slug?slug=`,
      );
      expect(res.status).toBe(400);
    });

    it('should return 400 if slug is missing', async () => {
      const res = await request(app.getHttpServer()).get(
        `/admin/categories/${categoryId}/validate-slug`,
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

    it('should return 400 if allowedSlugs is empty', async () => {
      const dto: CreateCategoryDto = {
        name: 'Empty Slug Category',
        allowedSlugs: [],
      };

      jest.spyOn(categoriesService, 'create').mockImplementationOnce(() => {
        throw new BadRequestException(CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED);
      });

      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([
        CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
      ]);
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
  });

  describe('GET /admin/categories/:id', () => {
    it('should return category details', async () => {
      const res = await request(app.getHttpServer()).get('/admin/categories/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCategoryDto);
      expect(categoriesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should return 404 if category not found', async () => {
      jest.spyOn(categoriesService, 'findOne').mockImplementationOnce(() => {
        throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      });

      const res = await request(app.getHttpServer()).get(
        '/admin/categories/999',
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
      );
    });
  });

  describe('PATCH /admin/categories/:id', () => {
    it('should update category', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated',
      } satisfies UpdateCategoryDto;

      const res = await request(app.getHttpServer())
        .patch('/admin/categories/1')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(mockCategoryDto);
      expect(categoriesService.update).toHaveBeenCalledWith(1, dto);
    });

    it('should return 400 if allowedSlugs is empty', async () => {
      const dto: UpdateCategoryDto = {
        allowedSlugs: [],
      };

      jest.spyOn(categoriesService, 'update').mockImplementationOnce(() => {
        throw new BadRequestException(CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED);
      });

      const res = await request(app.getHttpServer())
        .patch('/admin/categories/1')
        .send(dto)
        .expect(400);

      expect(res.body.message).toEqual([
        CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED,
      ]);
    });

    it('should return 409 if category name already exists', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Existing Category',
      };

      jest.spyOn(categoriesService, 'update').mockImplementationOnce(() => {
        throw new ConflictException(
          CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
        );
      });

      const res = await request(app.getHttpServer())
        .patch('/admin/categories/1')
        .send(dto)
        .expect(409);

      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.DUPLICATE_CATEGORY_NAME,
      );
    });

    it('should return 404 if category not found', async () => {
      jest.spyOn(categoriesService, 'update').mockImplementationOnce(() => {
        throw new NotFoundException(CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND);
      });

      const res = await request(app.getHttpServer()).patch(
        '/admin/categories/999',
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toEqual(
        CATEGORY_ERROR_MESSAGES.CATEGORY_NOT_FOUND,
      );
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('should delete category', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/admin/categories/1',
      );
      expect(res.status).toBe(200);
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
