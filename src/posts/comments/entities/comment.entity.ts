import { ApiProperty } from '@nestjs/swagger';
import { User } from '@/users/entities/user.entity';
import { Post } from '@/posts/entities/post.entity';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Expose } from 'class-transformer';

@Entity()
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

  // 대댓글 구현을 위한 자기 참조 관계
  @ApiProperty({ description: '부모 댓글 (대댓글인 경우)', nullable: true })
  @ManyToOne(() => Comment, (comment) => comment.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
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
  get nickname(): string | null {
    return this._nickname;
  }
}
