import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import * as request from 'supertest';
import { AdminBoardController } from './admin-board.controller';
import { BoardsService } from '@/boards/boards.service';
import { CreateBoardDto } from '@/boards/dto/create-board.dto';
import { UpdateBoardDto } from '@/boards/dto/update-board.dto';
import { AdminBoardResponseDto } from '@/boards/dto/admin-board-response.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '@/boards/entities/board.entity';
import { createBoard } from '@/boards/factories/board.factory';
import { createCategory } from '@/categories/factories/category.factory';

describe('AdminBoardController', () => {
  let app: INestApplication;
  let boardsService: BoardsService;

  const mockCategory = createCategory({ id: 1, name: 'Technology' });
  const mockBoard = createBoard({
    id: 1,
    slug: 'general',
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBoardController],
      providers: [
        {
          provide: BoardsService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
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
    await app.init();

    boardsService = module.get<BoardsService>(BoardsService);
  });

  describe('GET /admin/boards', () => {
    it('should return list of admin board DTOs', async () => {
      jest.spyOn(boardsService, 'findAll').mockResolvedValue([mockBoard]);
      const res = await request(app.getHttpServer()).get('/admin/boards');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([mockAdminBoardResponseDto]);
      expect(boardsService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /admin/boards/:id', () => {
    it('should return admin board DTO by ID', async () => {
      jest.spyOn(boardsService, 'findOne').mockResolvedValue(mockBoard);
      const res = await request(app.getHttpServer()).get('/admin/boards/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAdminBoardResponseDto);
      expect(boardsService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when board not found', async () => {
      jest
        .spyOn(boardsService, 'findOne')
        .mockRejectedValue(new NotFoundException('Board not found'));
      const res = await request(app.getHttpServer()).get('/admin/boards/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Board not found');
    });
  });

  describe('POST /admin/boards', () => {
    const dto: CreateBoardDto = {
      slug: 'new-board',
      name: 'New Board',
      description: 'New Description',
      requiredRole: UserRole.ADMIN,
      type: BoardPurpose.GENERAL,
      categoryId: 1,
    };

    it('should create a new board and return DTO', async () => {
      jest.spyOn(boardsService, 'create').mockResolvedValue(mockBoard);

      const res = await request(app.getHttpServer())
        .post('/admin/boards')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(mockAdminBoardResponseDto);
      expect(boardsService.create).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException if invalid data', async () => {
      const invalidDto = { ...dto, slug: '' };
      jest.spyOn(boardsService, 'create').mockImplementation(() => {
        throw new BadRequestException('Validation failed');
      });

      const res = await request(app.getHttpServer())
        .post('/admin/boards')
        .send(invalidDto)
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('PATCH /admin/boards/:id', () => {
    const dto: UpdateBoardDto = {
      name: 'Updated Name',
      categoryId: 2,
    };

    const updatedBoard = {
      ...mockBoard,
      name: 'Updated Name',
      category: createCategory({ id: 2, name: 'Science' }),
    };

    const updatedDto = {
      ...mockAdminBoardResponseDto,
      name: 'Updated Name',
      categoryId: 2,
      categoryName: 'Science',
    };

    it('should update board and return updated DTO', async () => {
      jest.spyOn(boardsService, 'update').mockResolvedValue(updatedBoard);

      const res = await request(app.getHttpServer())
        .patch('/admin/boards/1')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(updatedDto);
      expect(boardsService.update).toHaveBeenCalledWith(1, dto);
    });

    it('should throw NotFoundException if board not found', async () => {
      jest
        .spyOn(boardsService, 'update')
        .mockRejectedValue(new NotFoundException('Board not found'));

      const res = await request(app.getHttpServer())
        .patch('/admin/boards/999')
        .send(dto)
        .expect(404);

      expect(res.body.message).toBe('Board not found');
    });
  });

  describe('DELETE /admin/boards/:id', () => {
    it('should delete board successfully', async () => {
      jest.spyOn(boardsService, 'remove').mockResolvedValue(undefined);
      const res = await request(app.getHttpServer()).delete('/admin/boards/1');
      expect(res.status).toBe(200);
      expect(boardsService.remove).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if board not found', async () => {
      jest
        .spyOn(boardsService, 'remove')
        .mockRejectedValue(new NotFoundException('Board not found'));
      const res = await request(app.getHttpServer()).delete(
        '/admin/boards/999',
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Board not found');
    });
  });
});
