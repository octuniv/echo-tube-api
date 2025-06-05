import { Module } from '@nestjs/common';
import { AdminUserModule } from './user/admin-user.module';
import { AdminCategoryModule } from './category/admin-category.module';
import { AdminBoardModule } from './board/admin-board.module';

@Module({
  imports: [AdminUserModule, AdminCategoryModule, AdminBoardModule],
})
export class AdminModule {}

/* 
  
  ToDo : Create function to report user and post
  Inquiry All Activation
  Push Alarm or Message to User
  
*/
