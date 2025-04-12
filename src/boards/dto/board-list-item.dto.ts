import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@/users/entities/user-role.enum'; // UserRole enum 경로 확인
import { Board } from '../entities/board.entity';
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

  static fromEntity(board: Board): BoardListItemDto {
    return {
      id: board.id,
      slug: board.slug,
      name: board.name,
      description: board.description,
      requiredRole: board.requiredRole,
    };
  }
}
