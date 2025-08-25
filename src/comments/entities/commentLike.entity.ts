import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class CommentLike {
  @PrimaryColumn()
  userId: number;

  @PrimaryColumn()
  commentId: number;

  @CreateDateColumn()
  createdAt: Date;
}
