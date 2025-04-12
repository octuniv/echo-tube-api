import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Visitor } from './visitor.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
@Index(['date', 'userIdentifier'], { unique: true })
export class VisitorEntry {
  @ApiProperty({ description: 'Entry ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Visit date (YYYY-MM-DD)',
    example: '2023-10-05',
  })
  @Column({ type: 'date' })
  date: string;

  @ApiProperty({
    description: 'Unique visitor identifier (User Email (no duplication))',
  })
  @Column('text')
  userIdentifier: string;

  @ApiProperty({ description: 'Associated visitor record' })
  @ManyToOne(() => Visitor, (visitor) => visitor.entries, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'date', referencedColumnName: 'date' })
  visitor: Visitor;
}
