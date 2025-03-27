import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class Visitor {
  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ default: 0 })
  count: number;

  @Column('simple-array')
  uniqueVisitors: string[];
}
