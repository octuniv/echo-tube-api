import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'List of allowed slugs',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  slugs: string[];
}
