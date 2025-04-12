import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Category } from './category.entity';
import { ApiProperty } from '@nestjs/swagger';

// category-slug.entity.ts
@Entity()
export class CategorySlug {
  @ApiProperty({ description: 'Slug ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Unique slug identifier' })
  @Column({ unique: true })
  slug: string;

  @ApiProperty({ description: 'Associated category' })
  @ManyToOne(() => Category, (category) => category.slugs, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  category: Category;
}
