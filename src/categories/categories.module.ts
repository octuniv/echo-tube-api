import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoriesController } from './categories.controller';
import { CategorySlug } from './entities/category-slug.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, CategorySlug])],
  exports: [CategoriesService],
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
