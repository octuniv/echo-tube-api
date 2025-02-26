import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  AfterLoad,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  videoUrl?: string; // 비디오 링크 (선택사항)

  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  createdBy!: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  nickname?: string;

  @AfterLoad()
  setNickname() {
    this.nickname = this.createdBy?.nickName || null;
  }
}
