import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from './user-role.enum';
import { Post } from '@/posts/entities/post.entity';
import { Comment } from '@/comments/entities/comment.entity';

@Entity('users')
export class User {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'John Doe' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ example: 'johndoe123' })
  @Column({ unique: true, length: 255 })
  nickname: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  // 관계는 Swagger 스키마에 자동 포함되지 않도록 처리
  @OneToMany(() => Post, (post) => post.createdBy, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  posts: Post[];

  // User 엔티티에 추가
  @OneToMany(() => Comment, (comment) => comment.createdBy, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  comments: Comment[];

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  @DeleteDateColumn()
  deletedAt: Date | null;
}
