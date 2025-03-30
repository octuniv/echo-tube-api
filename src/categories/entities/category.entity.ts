// src/categories/entities/category.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Board } from '@/boards/entities/board.entity';
import { CategorySlug } from './category-slug.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => CategorySlug, (slug) => slug.category)
  slugs: CategorySlug[];

  @OneToMany(() => Board, (board) => board.category)
  boards: Board[];
}
