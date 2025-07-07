import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ValidateSlugQueryDto {
  @ApiProperty({
    name: 'slug',
    type: 'string',
    example: 'tech',
    description: '검증할 슬러그 값',
  })
  @IsNotEmpty({ message: 'slug는 필수입니다.' })
  @IsString()
  slug: string;

  @ApiProperty({
    name: 'categoryId',
    type: 'number',
    required: false,
    example: 1,
    description: '검증 대상 카테고리 ID (생략 시 모든 카테고리 검사)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}
