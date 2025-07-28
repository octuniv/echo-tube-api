import { ApiProperty } from '@nestjs/swagger';

export class CategorySlugDto {
  @ApiProperty({ example: 'tech' })
  slug: string;

  @ApiProperty({ example: true })
  isActive: boolean; // 슬러그 사용 가능 여부
}
