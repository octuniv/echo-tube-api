import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateSlugQueryDto {
  @ApiProperty({ example: 'tech', description: '검증할 슬러그' })
  @IsNotEmpty({ message: 'slug는 필수입니다.' })
  @IsString()
  slug: string;
}
