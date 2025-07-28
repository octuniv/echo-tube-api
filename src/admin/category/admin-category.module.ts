import { Module } from '@nestjs/common';
import { AdminCategoryController } from './admin-category.controller';
import { CategoriesModule } from '@/categories/categories.module';

@Module({
  imports: [CategoriesModule],
  controllers: [AdminCategoryController],
  providers: [],
})
export class AdminCategoryModule {}
