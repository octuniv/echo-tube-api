import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Board, BoardPurpose } from './entities/board.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardListItemDto } from './dto/board-list-item.dto';
import { ScrapingTargetBoardDto } from './dto/scraping-target-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
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
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        requiredRole: true,
        type: true,
      },
      order: { category: { name: 'ASC' }, name: 'ASC' },
    });
    return boards.map(BoardListItemDto.fromEntity);
  }

  // 특정 게시판 조회
  async findOne(slug: string): Promise<Board> {
    const board = await this.boardRepository.findOne({
      where: { slug },
      relations: ['category'],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        requiredRole: true, // 권한 정보 추가
        category: {
          id: true,
          name: true,
        },
      },
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
}
