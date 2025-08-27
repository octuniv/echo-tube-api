import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class PostLike {
  @PrimaryColumn()
  userId: number;

  @PrimaryColumn()
  postId: number;

  @CreateDateColumn()
  createdAt: Date;
}
