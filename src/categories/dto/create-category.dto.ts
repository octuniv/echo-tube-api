import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Technology',
    description: '카테고리 이름',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: ['tech', 'innovation'],
    description: '허용된 슬러그 목록',
  })
  @IsArray()
  @IsString({ each: true })
  allowedSlugs: string[];
}
