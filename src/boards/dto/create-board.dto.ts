import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/users/entities/user-role.enum';
import { BoardPurpose } from '../entities/board.entity';

export class CreateBoardDto {
  @ApiProperty({ example: 'general' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'General Discussion' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'General discussion board', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER,
    required: false,
  })
  @IsEnum(UserRole)
  @IsOptional()
  requiredRole?: UserRole;

  @ApiProperty({
    enum: BoardPurpose,
    enumName: 'BoardPurpose',
    example: BoardPurpose.GENERAL,
    required: false,
  })
  @IsEnum(BoardPurpose)
  @IsOptional()
  type?: BoardPurpose;

  @ApiProperty({ example: 1, description: 'Category ID' })
  @IsNumber()
  categoryId: number;
}
