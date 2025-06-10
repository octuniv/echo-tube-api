import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '../entities/board.entity';

export class AdminBoardResponseDto {
  @ApiProperty({ example: 1, description: 'Board ID' })
  id: number;

  @ApiProperty({ example: 'general', description: 'Board slug' })
  slug: string;

  @ApiProperty({ example: 'General Discussion', description: 'Board name' })
  name: string;

  @ApiProperty({ example: 'General discussion board', required: false })
  description?: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER,
  })
  requiredRole: UserRole;

  @ApiProperty({
    enum: BoardPurpose,
    enumName: 'BoardPurpose',
    example: BoardPurpose.GENERAL,
  })
  type: BoardPurpose;

  @ApiProperty({ example: 1, description: 'Category ID' })
  categoryId: number;

  @ApiProperty({ example: 'Technology', description: 'Category name' })
  categoryName: string;

  static fromEntity(board: any): AdminBoardResponseDto {
    return {
      id: board.id,
      slug: board.slug,
      name: board.name,
      description: board.description,
      requiredRole: board.requiredRole,
      type: board.type,
      categoryId: board.category.id,
      categoryName: board.category.name,
    };
  }
}
