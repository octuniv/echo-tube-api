import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { VisitorEntry } from './visitor-entry.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Visitor {
  @ApiProperty({
    description: 'Visit date (YYYY-MM-DD)',
    example: '2023-10-05',
  })
  @PrimaryColumn({ type: 'date' })
  date: string;

  @ApiProperty({ description: 'Total unique visitors for the day' })
  @Column({ default: 0 })
  count: number;

  @ApiProperty({ description: 'Individual visitor entries' })
  @OneToMany(() => VisitorEntry, (entry) => entry.visitor)
  entries: VisitorEntry[];
}
