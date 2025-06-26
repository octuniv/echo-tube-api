// src/common/dto/search-user.dto.ts
import { PaginationDto } from '@/common/dto/pagination.dto';
import { UserRole } from '@/users/entities/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export class SearchUserDto extends PaginationDto {
  @ApiProperty({ required: false, description: '이메일 검색 키워드' })
  @IsOptional()
  @IsString()
  searchEmail?: string;

  @ApiProperty({ required: false, description: '닉네임 검색 키워드' })
  @IsOptional()
  @IsString()
  searchNickname?: string;

  @ApiProperty({ required: false, description: '역할 필터 (USER/ADMIN/BOT)' })
  @IsOptional()
  @IsEnum(UserRole)
  searchRole?: UserRole;
}
