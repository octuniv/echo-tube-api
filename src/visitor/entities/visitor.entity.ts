import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Visitor {
  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ default: 0 })
  count: number;
}
