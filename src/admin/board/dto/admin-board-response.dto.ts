import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { Board, BoardPurpose } from '../../../boards/entities/board.entity';

export class AdminBoardResponseDto {
  @ApiProperty({
    example: 1,
    description: '게시판의 고유 식별자',
  })
  id: number;

  @ApiProperty({
    example: 'general',
    description: '게시판의 URL 친화적인 식별자 (영소문자, 숫자, 하이픈 허용)',
    pattern: '^[a-z0-9-]+$',
  })
  slug: string;

  @ApiProperty({
    example: '일반 게시판',
    description: '게시판의 표시 이름 (한글/영문 가능)',
  })
  name: string;

  @ApiProperty({
    example: '일반적인 토론 공간입니다.',
    description: '게시판의 설명 (선택적)',
    required: false,
  })
  description?: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER,
    description: '최소한의 접근 권한 (USER/ADMIN)',
  })
  requiredRole: UserRole;

  @ApiProperty({
    enum: BoardPurpose,
    enumName: 'BoardPurpose',
    example: BoardPurpose.GENERAL,
    description: '게시판 용도 (일반/공지사항/자유 등)',
  })
  type: BoardPurpose;

  @ApiProperty({
    example: 1,
    description: '소속된 카테고리 ID',
  })
  categoryId: number;

  @ApiProperty({
    example: '공지사항',
    description: '소속된 카테고리 이름',
  })
  categoryName: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Deletion timestamp', required: false })
  deletedAt?: Date | null;

  static fromEntity(board: Board): AdminBoardResponseDto {
    return {
      id: board.id,
      slug: board.slug,
      name: board.name,
      description: board.description,
      requiredRole: board.requiredRole,
      type: board.type,
      categoryId: board.category.id,
      categoryName: board.category.name,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      deletedAt: board.deletedAt || null,
    };
  }
}
