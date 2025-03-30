// find-recent.dto.ts
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class FindRecentPostsDto {
  @IsNumber({}, { each: true })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((v) => Number(v)) : [Number(value)],
  )
  boardIds?: number[];

  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
