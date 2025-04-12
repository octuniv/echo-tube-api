// find-recent.dto.ts
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FindRecentPostsDto {
  @ApiProperty({ example: [1, 2], required: false })
  @IsNumber({}, { each: true })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(Number) : [Number(value)],
  )
  boardIds?: number[];

  @ApiProperty({ example: 10, minimum: 0, maximum: 50 })
  @Min(0)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
