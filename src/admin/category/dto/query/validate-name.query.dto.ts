import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class ValidateNameQueryDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  readonly categoryId?: number;
}
