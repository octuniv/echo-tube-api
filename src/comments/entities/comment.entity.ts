import { ApiProperty } from '@nestjs/swagger';
import { User } from '@/users/entities/user.entity';
import { Post } from '@/posts/entities/post.entity';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Expose } from 'class-transformer';

@Entity()
@Index(['parent'])
@Index(['post', 'parent'])
@Index(['deletedAt'])
export class Comment {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: '게시물이 정말 좋네요!' })
  @Column({ type: 'text' })
  content: string;

  @ApiProperty({ example: 0 })
  @Column({ default: 0 })
  likes: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  @DeleteDateColumn()
  deletedAt: Date | null;

  // 게시물과의 관계
  @ApiProperty({ description: '부모 게시물' })
  @ManyToOne(() => Post, (post) => post.comments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  post: Post;

  // 사용자와의 관계
  @ApiProperty({ description: '댓글 작성자' })
  @ManyToOne(() => User, (user) => user.comments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  createdBy: User;

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: Comment;

  @ApiProperty({ description: '자식 댓글 (대댓글)' })
  @OneToMany(() => Comment, (comment) => comment.parent, {
    cascade: true,
  })
  children: Comment[];

  // 작성자 닉네임을 직접 저장하여 soft delete 문제 해결
  @Column({ select: false, nullable: true })
  private _nickname?: string;

  @AfterLoad()
  setNickname() {
    this._nickname = this.createdBy?.nickname ?? null;
  }

  @Expose()
  @ApiProperty({ description: '작성자 닉네임', required: false })
  get nickname(): string {
    return this.deletedAt ? '알 수 없음' : this.createdBy?.nickname || '익명';
  }
}
