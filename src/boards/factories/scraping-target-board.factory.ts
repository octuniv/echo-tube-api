// src/boards/factories/scraping-target-board.factory.ts
import { ScrapingTargetBoardDto } from '../dto/scraping-target-board.dto';

export const createScrapingTargetBoard = (
  overrides?: Partial<ScrapingTargetBoardDto>,
): ScrapingTargetBoardDto => {
  return {
    slug: 'youtube-videos',
    name: 'YouTube Videos',
    ...overrides,
  };
};
