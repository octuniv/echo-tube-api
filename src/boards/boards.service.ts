import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Board, BoardPurpose } from './entities/board.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardListItemDto } from './dto/list/board-list-item.dto';
import { ScrapingTargetBoardDto } from './dto/scraping/scraping-target-board.dto';
import { CreateBoardDto } from './dto/CRUD/create-board.dto';
import { UpdateBoardDto } from './dto/CRUD/update-board.dto';
import { CategoriesService } from '@/categories/categories.service';
import { UserRole } from '@/users/entities/user-role.enum';

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
      throw new NotFoundException('게시판을 찾을 수 없습니다');
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
      throw new NotFoundException('Board not found');
    }
    return board;
  }

  async create(dto: CreateBoardDto): Promise<Board> {
    const { categoryId, ...rest } = dto;
    if (
      dto.type === BoardPurpose.AI_DIGEST &&
      dto.requiredRole === UserRole.USER
    ) {
      throw new BadRequestException(
        'AI_DIGEST 보드는 USER 이상의 권한이 필요합니다.',
      );
    }
    const category = await this.categoriesService.findOne(categoryId);
    const board = this.boardRepository.create({
      ...rest,
      category,
    });
    return this.boardRepository.save(board);
  }

  async update(id: number, dto: UpdateBoardDto): Promise<Board> {
    const board = await this.findOne(id);

    if (dto.categoryId) {
      const category = await this.categoriesService.findOne(dto.categoryId);
      board.category = category;
    }

    // 명시적 프로퍼티 업데이트
    if (dto.slug !== undefined) board.slug = dto.slug;
    if (dto.name !== undefined) board.name = dto.name;
    if (dto.description !== undefined) board.description = dto.description;
    if (dto.requiredRole !== undefined) board.requiredRole = dto.requiredRole;
    if (dto.type !== undefined) board.type = dto.type;

    // 검증 로직 강화
    if (
      board.type === BoardPurpose.AI_DIGEST &&
      board.requiredRole === UserRole.USER
    ) {
      throw new BadRequestException(
        'AI_DIGEST 보드는 USER 이상의 권한이 필요합니다.',
      );
    }

    return this.boardRepository.save(board);
  }

  async remove(id: number): Promise<void> {
    const result = await this.boardRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Board not found');
    }
  }
}
