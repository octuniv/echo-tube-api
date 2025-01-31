import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Index(['token', 'revoked'])
@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userEmail: string;

  @Column({ unique: true })
  token: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;
}
