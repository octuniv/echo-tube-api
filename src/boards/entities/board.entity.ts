// src/boards/entities/board.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  Index,
} from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { Category } from '@/categories/entities/category.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export enum BoardPurpose {
  GENERAL = 'general',
  AI_DIGEST = 'ai_digest',
}

@Index(['type', 'slug'], { unique: true })
@Entity()
export class Board {
  @ApiProperty({ description: 'Board ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Unique board identifier' })
  @Column({ unique: true })
  slug: string;

  @ApiProperty({ description: 'Board display name' })
  @Column()
  name: string;

  @ApiProperty({
    description: 'Optional board description',
    required: false,
  })
  @Column({ nullable: true })
  description?: string;

  @ApiProperty({
    description: 'Minimum user role required to access',
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.USER,
  })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  requiredRole: UserRole;

  @Column({
    type: 'enum',
    enum: BoardPurpose,
    default: BoardPurpose.GENERAL,
  })
  type: BoardPurpose;

  @ApiProperty({ description: 'Associated posts', type: [Post] })
  @OneToMany(() => Post, (post) => post.board)
  posts: Post[];

  @ApiProperty({ description: 'Parent category' })
  @ManyToOne(() => Category, (category) => category.boards, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  category: Category;
}
