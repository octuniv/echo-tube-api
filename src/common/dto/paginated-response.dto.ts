// src/common/dto/paginated-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ example: 1, description: '현재 페이지 번호' })
  currentPage: number;

  @ApiProperty({ example: 100, description: '전체 항목 수' })
  totalItems: number;

  @ApiProperty({ example: 10, description: '전체 페이지 수' })
  totalPages: number;
}
