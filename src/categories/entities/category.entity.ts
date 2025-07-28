// src/categories/entities/category.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Board } from '@/boards/entities/board.entity';
import { CategorySlug } from './category-slug.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Category {
  @ApiProperty({ description: 'Category ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Category name' })
  @Column({ unique: true })
  name: string;

  @ApiProperty({ description: 'Associated slugs', type: [CategorySlug] })
  @OneToMany(() => CategorySlug, (slug) => slug.category, {
    onDelete: 'CASCADE',
  })
  slugs: CategorySlug[];

  @ApiProperty({ description: 'Associated boards', type: [Board] })
  @OneToMany(() => Board, (board) => board.category, { onDelete: 'CASCADE' })
  boards: Board[];

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
