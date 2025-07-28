import { UserRole } from '@/users/entities/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Board, BoardPurpose } from '../entities/board.entity';

export class BoardSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'technology' })
  slug: string;

  @ApiProperty({ example: 'Technology Discussion' })
  name: string;

  @ApiProperty({ example: 'General' })
  type: BoardPurpose;

  @ApiProperty({ example: 'user' })
  requiredRole: UserRole;

  static fromEntity(board: Board): BoardSummaryDto {
    const dto = new BoardSummaryDto();
    dto.id = board.id;
    dto.slug = board.categorySlug.slug;
    dto.name = board.name;
    dto.type = board.type;
    dto.requiredRole = board.requiredRole;
    return dto;
  }
}
