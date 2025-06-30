import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@/users/entities/user-role.enum';
import { Board, BoardPurpose } from '../../entities/board.entity';
import { ApiProperty } from '@nestjs/swagger';

export class BoardListItemDto {
  @ApiProperty({ example: 1, description: 'Board identifier' })
  @IsInt()
  id: number;

  @ApiProperty({ example: 'general', description: 'Unique slug' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'General Discussion', description: 'Display name' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'General discussion board',
    required: false,
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER,
    description: 'Access permission level',
  })
  @IsEnum(UserRole)
  requiredRole: UserRole;

  @ApiProperty({
    enum: BoardPurpose,
    enumName: 'BoardPurpose',
    example: BoardPurpose.GENERAL,
    description: 'Author type for this board',
  })
  @IsEnum(BoardPurpose)
  boardType: BoardPurpose;

  static fromEntity(board: Board): BoardListItemDto {
    return {
      id: board.id,
      slug: board.slug,
      name: board.name,
      description: board.description,
      requiredRole: board.requiredRole,
      boardType: board.type,
    };
  }
}
