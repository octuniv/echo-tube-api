import { CATEGORY_ERROR_MESSAGES } from '@/common/constants/error-messages.constants';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ArrayMinSize,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Technology',
    description: '카테고리 이름',
  })
  @IsString()
  @IsNotEmpty({ message: CATEGORY_ERROR_MESSAGES.NAME_REQUIRED })
  name: string;

  @ApiProperty({
    example: ['tech', 'innovation'],
    description: '허용된 슬러그 목록',
  })
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-z0-9-]+$/, {
    each: true,
    message: CATEGORY_ERROR_MESSAGES.INVALID_SLUGS,
  })
  @ArrayMinSize(1, { message: CATEGORY_ERROR_MESSAGES.SLUGS_REQUIRED })
  allowedSlugs: string[];
}
