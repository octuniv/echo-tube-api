import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { AdminBoardController } from './admin-board.controller';
import { BoardsService } from '@/boards/boards.service';
import { CreateBoardDto } from '@/admin/board/dto/CRUD/create-board.dto';
import { UpdateBoardDto } from '@/admin/board/dto/CRUD/update-board.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { createBoard } from '@/boards/factories/board.factory';
import {
  createCategory,
  createCategorySlug,
} from '@/categories/factories/category.factory';
import { AdminBoardResponseDto } from '@/admin/board/dto/admin-board-response.dto';
import { createMock } from '@golevelup/ts-jest';
import { BOARD_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';

describe('AdminBoardController', () => {
  let app: INestApplication;
  let boardsService: BoardsService;

  const mockCategory = createCategory({ id: 1, name: 'Technology' });
  const mockBoard = createBoard({
    id: 1,
    categorySlug: createCategorySlug({ slug: 'general' }),
    name: 'General Discussion',
    description: 'General discussion board',
    requiredRole: UserRole.USER,
    type: BoardPurpose.GENERAL,
    category: mockCategory,
  });

  const mockAdminBoardResponseDto: AdminBoardResponseDto = {
    id: 1,
    slug: 'general',
    name: 'General Discussion',
    description: 'General discussion board',
    requiredRole: UserRole.USER,
    type: BoardPurpose.GENERAL,
    categoryId: 1,
    categoryName: 'Technology',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const returnedAdminBoardResponseDto = {
    ...mockAdminBoardResponseDto,
    createdAt: mockAdminBoardResponseDto.createdAt.toISOString(),
    updatedAt: mockAdminBoardResponseDto.updatedAt.toISOString(),
  };

  const createBoardDto: CreateBoardDto = {
    slug: 'new-board',
    name: 'New Board',
    description: 'New Description',
    requiredRole: UserRole.ADMIN,
    type: BoardPurpose.GENERAL,
    categoryId: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBoardController],
      providers: [
        {
          provide: BoardsService,
          useValue: createMock<BoardsService>(),
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { role: UserRole.ADMIN };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();

    boardsService = module.get<BoardsService>(BoardsService);
  });

  describe('GET /admin/boards', () => {
    it('should return list of admin board DTOs', async () => {
      jest.spyOn(boardsService, 'findAll').mockResolvedValue([mockBoard]);
      const res = await request(app.getHttpServer()).get('/admin/boards');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject([returnedAdminBoardResponseDto]);
      expect(boardsService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /admin/boards/:id', () => {
    it('should return admin board DTO by ID', async () => {
      jest.spyOn(boardsService, 'findOne').mockResolvedValue(mockBoard);
      const res = await request(app.getHttpServer()).get('/admin/boards/1');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(returnedAdminBoardResponseDto);
      expect(boardsService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when board not found', async () => {
      jest
        .spyOn(boardsService, 'findOne')
        .mockRejectedValue(
          new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
        );
      const res = await request(app.getHttpServer()).get('/admin/boards/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD);
    });
  });

  describe('POST /admin/boards', () => {
    it('should create a new board and return DTO', async () => {
      jest.spyOn(boardsService, 'create').mockResolvedValue(mockBoard);

      const res = await request(app.getHttpServer())
        .post('/admin/boards')
        .send(createBoardDto)
        .expect(201);

      expect(res.body).toMatchObject(returnedAdminBoardResponseDto);
      expect(boardsService.create).toHaveBeenCalledWith(createBoardDto);
    });

    it('should throw BadRequestException if slug is invalid', async () => {
      const invalidDto = {
        ...createBoardDto,
        slug: 'Invalid_Slug!', // Violates the regex pattern
      };
      const res = await request(app.getHttpServer())
        .post('/admin/boards')
        .send(invalidDto)
        .expect(400);
      expect(res.body.message).toContain(BOARD_ERROR_MESSAGES.INVALID_SLUGS);
    });

    it('should throw BadRequestException if name is empty', async () => {
      const invalidDto = {
        ...createBoardDto,
        name: '', // Empty name
      };
      const res = await request(app.getHttpServer())
        .post('/admin/boards')
        .send(invalidDto)
        .expect(400);
      expect(res.body.message).toContain('name should not be empty');
    });
  });

  describe('PUT /admin/boards/:id', () => {
    const updateBoardDto: UpdateBoardDto = {
      ...createBoardDto,
      name: 'Updated Name',
      categoryId: 2,
    };

    const updatedBoard = {
      ...mockBoard,
      name: 'Updated Name',
      category: createCategory({ id: 2, name: 'Science' }),
    };

    const updatedDtoBase = {
      ...mockAdminBoardResponseDto,
      name: 'Updated Name',
      categoryId: 2,
      categoryName: 'Science',
    };

    const updatedDtoResponse = {
      ...updatedDtoBase,
      createdAt: updatedDtoBase.createdAt.toISOString(), // Convert to ISO string
      updatedAt: updatedDtoBase.updatedAt.toISOString(), // Convert to ISO string
    };

    it('should update board and return updated DTO', async () => {
      jest.spyOn(boardsService, 'update').mockResolvedValue(updatedBoard);

      const res = await request(app.getHttpServer())
        .put('/admin/boards/1')
        .send(updateBoardDto)
        .expect(200);

      expect(res.body).toMatchObject(updatedDtoResponse);
      expect(boardsService.update).toHaveBeenCalledWith(1, updateBoardDto);
    });

    it('should throw BadRequestException if slug is invalid', async () => {
      const invalidDto = {
        ...updateBoardDto,
        slug: 'Invalid_Slug!', // Violates the regex pattern
      };
      const res = await request(app.getHttpServer())
        .put('/admin/boards/1')
        .send(invalidDto)
        .expect(400);
      expect(res.body.message).toContain(BOARD_ERROR_MESSAGES.INVALID_SLUGS);
    });

    it('should throw BadRequestException if name is empty', async () => {
      const invalidDto = {
        ...updateBoardDto,
        name: '', // Empty name
      };
      const res = await request(app.getHttpServer())
        .put('/admin/boards/1')
        .send(invalidDto)
        .expect(400);
      expect(res.body.message).toContain('name should not be empty');
    });

    it('should throw NotFoundException if board not found', async () => {
      jest
        .spyOn(boardsService, 'update')
        .mockRejectedValue(
          new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
        );

      const res = await request(app.getHttpServer())
        .put('/admin/boards/999')
        .send(updateBoardDto)
        .expect(404);

      expect(res.body.message).toBe(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD);
    });

    it('should throw BadRequestException if slug is not allowed in category', async () => {
      const invalidDto = {
        ...createBoardDto,
        slug: 'invalid-slug',
        categoryId: 999,
      };
      jest.spyOn(boardsService, 'update').mockImplementation(() => {
        throw new BadRequestException(
          BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(invalidDto.slug),
        );
      });
      const res = await request(app.getHttpServer())
        .put('/admin/boards/1')
        .send(invalidDto)
        .expect(400);
      expect(res.body.message).toBe(
        BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(invalidDto.slug),
      );
    });
  });

  describe('DELETE /admin/boards/:id', () => {
    it('should delete board successfully', async () => {
      jest.spyOn(boardsService, 'remove').mockResolvedValue(undefined);
      const res = await request(app.getHttpServer()).delete('/admin/boards/1');
      expect(res.status).toBe(204);
      expect(boardsService.remove).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if board not found', async () => {
      jest
        .spyOn(boardsService, 'remove')
        .mockRejectedValue(
          new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD),
        );
      const res = await request(app.getHttpServer()).delete(
        '/admin/boards/999',
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD);
    });
  });
});
