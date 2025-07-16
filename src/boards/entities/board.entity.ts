// src/boards/entities/board.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { Category } from '@/categories/entities/category.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { CategorySlug } from '@/categories/entities/category-slug.entity';

export enum BoardPurpose {
  GENERAL = 'general',
  AI_DIGEST = 'ai_digest',
}

@Entity()
export class Board {
  @ApiProperty({ description: 'Board ID' })
  @PrimaryGeneratedColumn()
  id: number;

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

  @ApiProperty({ description: 'Unique board identifier by categorySlug' })
  @OneToOne(() => CategorySlug, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  categorySlug: CategorySlug;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({ description: 'Deletion timestamp', required: false })
  @DeleteDateColumn()
  deletedAt: Date | null;
}
