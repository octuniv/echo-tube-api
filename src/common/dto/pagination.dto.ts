// src/common/dto/pagination.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PaginationDto {
  @ApiProperty({ example: 1, description: '페이지 번호' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ example: 10, description: '페이지당 항목 수' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
