// src/admin/category/admin-category.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AdminCategoryController } from '@/admin/category/admin-category.controller';
import { CategoriesService } from '@/categories/categories.service';
import { CategoryDetailsResponseDto } from '@/categories/dto/category-details-response.dto';
import { CreateCategoryDto } from '@/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/categories/dto/update-category.dto';
import { CategoryResponseDto } from '@/categories/dto/category-response.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { UserRole } from '@/users/entities/user-role.enum';

describe('AdminCategoryController', () => {
  let app: INestApplication;
  //   let controller: AdminCategoryController;
  let categoriesService: CategoriesService;

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
          useValue: {
            getAllCategoriesWithSlugs: jest.fn(),
            create: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
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
    await app.init();

    // controller = module.get<AdminCategoryController>(AdminCategoryController);
    categoriesService = module.get<CategoriesService>(CategoriesService);
  });

  describe('GET /admin/categories', () => {
    it('should return list of categories', async () => {
      const mockResponse = [
        { name: 'Test', allowedSlugs: ['test'] },
      ] satisfies CategoryResponseDto[];
      jest
        .spyOn(categoriesService, 'getAllCategoriesWithSlugs')
        .mockResolvedValue(mockResponse as any);

      const res = await request(app.getHttpServer()).get('/admin/categories');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    });
  });

  describe('POST /admin/categories', () => {
    it('should create category', async () => {
      const dto: CreateCategoryDto = {
        name: 'New',
        allowedSlugs: ['new'],
      } satisfies CreateCategoryDto;
      jest
        .spyOn(categoriesService, 'create')
        .mockResolvedValue(mockCategoryDto);

      const res = await request(app.getHttpServer())
        .post('/admin/categories')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockCategoryDto);
    });
  });

  describe('GET /admin/categories/:id', () => {
    it('should return category details', async () => {
      jest
        .spyOn(categoriesService, 'findOne')
        .mockResolvedValue(mockCategoryDto);

      const res = await request(app.getHttpServer()).get('/admin/categories/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCategoryDto);
    });
  });

  describe('PATCH /admin/categories/:id', () => {
    it('should update category', async () => {
      const dto: UpdateCategoryDto = {
        name: 'Updated',
      } satisfies UpdateCategoryDto;
      jest
        .spyOn(categoriesService, 'update')
        .mockResolvedValue(mockCategoryDto);

      const res = await request(app.getHttpServer())
        .patch('/admin/categories/1')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(mockCategoryDto);
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('should delete category', async () => {
      jest.spyOn(categoriesService, 'remove').mockResolvedValue(undefined);

      const res = await request(app.getHttpServer()).delete(
        '/admin/categories/1',
      );
      expect(res.status).toBe(200);
    });
  });
});
