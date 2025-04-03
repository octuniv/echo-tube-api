import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@/users/entities/user-role.enum'; // UserRole enum 경로 확인
import { Board } from '../entities/board.entity';

export class BoardListItemDto {
  @IsInt()
  id: number;

  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(UserRole) // enum 타입 검증 추가
  requiredRole: UserRole; // 권한 필드 추가

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
