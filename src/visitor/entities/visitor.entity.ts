import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { VisitorEntry } from './visitor-entry.entity';

@Entity()
export class Visitor {
  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ default: 0 })
  count: number;

  @OneToMany(() => VisitorEntry, (entry) => entry.visitor)
  entries: VisitorEntry[];
}
