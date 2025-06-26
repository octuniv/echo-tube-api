// src/common/dto/pagination.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional, IsEnum } from 'class-validator';

export class PaginationDto {
  @ApiProperty({ example: 1, description: '페이지 번호' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiProperty({ example: 10, description: '페이지당 항목 수' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @ApiProperty({
    required: false,
    example: 'createdAt',
    description: '정렬 기준 필드 (createdAt/updatedAt)',
  })
  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt'])
  sort?: 'createdAt' | 'updatedAt';

  @ApiProperty({
    required: false,
    example: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';
}
