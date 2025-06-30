import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    example: 'Technology',
    description: '카테고리 이름',
  })
  name: string;

  @ApiProperty({
    example: ['tech', 'innovation', 'gadgets'],
    description: '허용된 슬러그 목록',
  })
  allowedSlugs: string[];
}
