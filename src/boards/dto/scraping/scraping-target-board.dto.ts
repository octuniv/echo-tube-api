import { Board } from '../../entities/board.entity';

export class ScrapingTargetBoardDto {
  slug: string;
  name: string;

  static fromEntity(entity: Board): ScrapingTargetBoardDto {
    return {
      slug: entity.categorySlug.slug,
      name: entity.name,
    };
  }
}
