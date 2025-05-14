import { faker } from '@faker-js/faker';
import { CreateScrapedVideoDto } from '../dto/create-scraped-video.dto';

export class VideoFactory {
  create(overrides?: Partial<CreateScrapedVideoDto>): CreateScrapedVideoDto {
    const youtubeId = faker.string.alphanumeric(11);
    const baseDto: CreateScrapedVideoDto = {
      youtubeId,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      channelTitle: faker.internet.displayName(),
      duration: faker.helpers.arrayElement([
        '3:45',
        '8:12',
        '15:30',
        '1:22:45',
      ]),
      topic: faker.helpers.arrayElement([
        'music',
        'tech',
        'education',
        'sports',
        'cooking',
      ]),
    };

    return { ...baseDto, ...overrides };
  }

  createMany(
    count: number,
    overrides?: Partial<CreateScrapedVideoDto>,
  ): CreateScrapedVideoDto[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
