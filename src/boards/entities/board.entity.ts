// src/boards/entities/board.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Post } from '@/posts/entities/post.entity';
import { Category } from '@/categories/entities/category.entity';
import { UserRole } from '@/users/entities/user-role.enum';

@Entity()
export class Board {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @OneToMany(() => Post, (post) => post.board)
  posts: Post[];

  @ManyToOne(() => Category, (category) => category.boards, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  category: Category;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  requiredRole: UserRole;
}
