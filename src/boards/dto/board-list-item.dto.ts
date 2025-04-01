import { IsInt, IsOptional, IsString } from 'class-validator';

export class BoardListItemDto {
  @IsInt()
  id: number;

  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
