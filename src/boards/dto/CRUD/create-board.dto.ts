import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '../../entities/board.entity';

export class CreateBoardDto {
  @ApiProperty({
    example: 'general',
    description: '게시판의 URL 친화적인 식별자',
  })
  @IsString()
  slug: string;

  @ApiProperty({
    example: 'General Discussion',
    description: '게시판의 표시 이름',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'General discussion board',
    description: '게시판의 설명 (선택적)',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER,
    description: '최소한의 접근 권한',
    required: false,
  })
  @IsEnum(UserRole)
  @IsOptional()
  requiredRole?: UserRole;

  @ApiProperty({
    enum: BoardPurpose,
    enumName: 'BoardPurpose',
    example: BoardPurpose.GENERAL,
    description: '게시판 용도',
    required: false,
  })
  @IsEnum(BoardPurpose)
  @IsOptional()
  type?: BoardPurpose;

  @ApiProperty({
    example: 1,
    description: '소속된 카테고리 ID',
  })
  @IsNumber()
  categoryId: number;
}
