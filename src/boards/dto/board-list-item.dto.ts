import { IsInt, IsString } from 'class-validator';

export class BoardListItemDto {
  @IsInt()
  id: number;

  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  description?: string;
}
