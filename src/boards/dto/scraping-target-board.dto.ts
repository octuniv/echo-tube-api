import { Board } from '../entities/board.entity';

// src/boards/dto/scraping-target-board.dto.ts
export class ScrapingTargetBoardDto {
  slug: string;
  name: string;

  static fromEntity(entity: Board): ScrapingTargetBoardDto {
    return {
      slug: entity.slug,
      name: entity.name,
    };
  }
}
