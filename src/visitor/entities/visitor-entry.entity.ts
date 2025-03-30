import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Visitor } from './visitor.entity';

@Entity()
@Index(['date', 'userIdentifier'], { unique: true })
export class VisitorEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column('text')
  userIdentifier: string;

  @ManyToOne(() => Visitor, (visitor) => visitor.entries, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'date', referencedColumnName: 'date' })
  visitor: Visitor;
}
