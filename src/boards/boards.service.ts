import { Injectable, NotFoundException } from '@nestjs/common';
import { Board } from './entities/board.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
  ) {}

  // 모든 게시판 조회
  async findAll(): Promise<Board[]> {
    return this.boardRepository.find({
      relations: ['category'],
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  // 특정 게시판 조회
  async findOne(id: number): Promise<Board> {
    const board = await this.boardRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!board) {
      throw new NotFoundException('게시판을 찾을 수 없습니다');
    }
    return board;
  }
}
