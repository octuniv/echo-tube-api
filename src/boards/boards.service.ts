import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Board, BoardPurpose } from './entities/board.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { BoardListItemDto } from './dto/list/board-list-item.dto';
import { ScrapingTargetBoardDto } from './dto/scraping/scraping-target-board.dto';
import { CreateBoardDto } from '../admin/board/dto/CRUD/create-board.dto';
import { UpdateBoardDto } from '../admin/board/dto/CRUD/update-board.dto';
import { CategoriesService } from '@/categories/categories.service';
import { UserRole } from '@/users/entities/user-role.enum';
import { BOARD_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';
import { Transactional } from 'typeorm-transactional';
import { Category } from '@/categories/entities/category.entity';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
    private categoriesService: CategoriesService,
  ) {}

  // 모든 게시판 조회 (내부용)
  async findAll(): Promise<Board[]> {
    return this.boardRepository.find({
      relations: ['category'],
      order: { category: { name: 'ASC' }, name: 'ASC' },
    });
  }

  // DTO 매핑 추가 메서드 (외부 응답용)
  async findAllForList(): Promise<BoardListItemDto[]> {
    const boards = await this.boardRepository.find({
      order: { category: { name: 'ASC' }, name: 'ASC' },
    });
    return boards.map(BoardListItemDto.fromEntity);
  }

  // 특정 게시판 조회
  async findOneBySlug(slug: string): Promise<Board> {
    const board = await this.boardRepository.findOne({
      where: { slug },
      relations: ['category'],
    });
    if (!board) {
      throw new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD);
    }
    return board;
  }

  async validateBoardType(boardSlug: string, expectedType: BoardPurpose) {
    const board = await this.boardRepository.findOne({
      where: { slug: boardSlug },
    });
    if (board.type !== expectedType) {
      throw new BadRequestException(`This board is for ${board.type}s only`);
    }
  }

  async getScrapingTargetBoards(): Promise<ScrapingTargetBoardDto[]> {
    const entities = await this.boardRepository.find({
      where: { type: BoardPurpose.AI_DIGEST },
      select: ['slug', 'name'],
    });
    return entities.map(ScrapingTargetBoardDto.fromEntity);
  }

  async findOne(id: number): Promise<Board> {
    const board = await this.boardRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!board) {
      throw new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD);
    }
    return board;
  }

  private async validateSlugWithinCategory(
    slug: string,
    categoryId: number,
  ): Promise<Category> {
    const category = await this.categoriesService.findOne(categoryId);
    if (!category.slugs.some((s) => s.slug === slug)) {
      throw new BadRequestException(
        BOARD_ERROR_MESSAGES.SLUG_NOT_ALLOWED_IN_CATEGORY(slug),
      );
    }
    return category;
  }

  private async checkSlugUniqueness(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existingBoard = await this.boardRepository.findOne({
      where: {
        slug,
        ...(excludeId && { id: Not(excludeId) }),
      },
    });

    if (existingBoard) {
      throw new BadRequestException(BOARD_ERROR_MESSAGES.DUPLICATE_SLUG(slug));
    }
  }

  private async validateRole(board: Board): Promise<void> {
    if (
      board.type === BoardPurpose.AI_DIGEST &&
      board.requiredRole === UserRole.USER
    ) {
      throw new BadRequestException(
        BOARD_ERROR_MESSAGES.AI_DIGEST_REQUIRES_HIGHER_ROLE,
      );
    }
  }

  @Transactional()
  async create(dto: CreateBoardDto): Promise<Board> {
    const { categoryId, ...rest } = dto;
    const category = await this.validateSlugWithinCategory(
      dto.slug,
      categoryId,
    );
    await this.checkSlugUniqueness(dto.slug);

    const board = this.boardRepository.create({
      ...rest,
      category,
    });
    await this.validateRole(board);
    return this.boardRepository.save(board);
  }

  @Transactional()
  async update(id: number, dto: UpdateBoardDto): Promise<Board> {
    const board = await this.findOne(id);
    const category = await this.validateSlugWithinCategory(
      dto.slug,
      dto.categoryId,
    );
    board.category = category;

    await this.checkSlugUniqueness(dto.slug, id);

    Object.assign(board, dto);

    await this.validateRole(board);

    return this.boardRepository.save(board);
  }

  async remove(id: number): Promise<void> {
    const result = await this.boardRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(BOARD_ERROR_MESSAGES.NOT_FOUND_BOARD);
    }
  }
}
