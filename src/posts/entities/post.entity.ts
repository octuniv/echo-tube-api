import { ApiProperty } from '@nestjs/swagger';
import { Board } from '@/boards/entities/board.entity';
import { User } from '@/users/entities/user.entity';
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
import { Comment } from '@/comments/entities/comment.entity';

export enum PostOrigin {
  USER = 'user',
  SCRAPED = 'scraped',
}

@Entity()
export class Post {
  @ApiProperty({ description: 'Post ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Post title' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ description: 'Post content' })
  @Column({ type: 'text' })
  content: string;

  @ApiProperty({ description: 'Optional video URL', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  videoUrl?: string;

  @ApiProperty({ description: 'View count' })
  @Column({ default: 0 })
  views: number;

  @ApiProperty({ description: 'Comment count' })
  @Column({ default: 0 })
  commentsCount: number;

  @ApiProperty({ description: 'Like count' })
  @Column({ default: 0 })
  likesCount: number;

  @ApiProperty({ description: 'Hot score algorithm result' })
  @Column({ type: 'float', default: 0 })
  hotScore: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({ description: 'Deletion timestamp', required: false })
  @DeleteDateColumn()
  deletedAt: Date | null;

  @ApiProperty({ description: 'Author information' })
  @ManyToOne(() => User, (user) => user.posts, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  createdBy!: User;

  @ApiProperty({ description: 'Associated board' })
  @ManyToOne(() => Board, (board) => board.posts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  board: Board;

  @Column({ select: false, nullable: true })
  private _nickname?: string;

  @AfterLoad()
  setNickname() {
    this._nickname = this.createdBy?.nickname ?? null;
  }

  @Expose()
  @ApiProperty({ description: 'Author nickname', required: false })
  get nickname(): string | null {
    return this._nickname;
  }

  @Column({ type: 'enum', enum: PostOrigin, default: PostOrigin.USER })
  type: PostOrigin;

  // 봇에 의해 정의된 영상 게시물 정보
  @Column({ nullable: true })
  channelTitle?: string;

  @Column({ nullable: true })
  duration?: string;

  @Column({ nullable: true })
  source?: string; // "YouTube" 등 출처

  // Post 엔티티에 추가
  @OneToMany(() => Comment, (comment) => comment.post, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  comments: Comment[];
}
