import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class AvailableCategoriesQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly boardId?: number;
}
