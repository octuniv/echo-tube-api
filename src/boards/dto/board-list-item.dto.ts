import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@/users/entities/user-role.enum'; // UserRole enum 경로 확인
import { Board } from '../entities/board.entity';
import { ApiProperty } from '@nestjs/swagger';

export class BoardListItemDto {
  @ApiProperty({ type: Number }) // Swagger 타입 명시
  @IsInt()
  id: number;

  @ApiProperty({ type: String })
  @IsString()
  slug: string;

  @ApiProperty({ type: String })
  @IsString()
  name: string;

  @ApiProperty({ type: String, required: false }) // 선택적 필드
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) // Enum 타입 명시
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
