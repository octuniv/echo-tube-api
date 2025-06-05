import { UsersModule } from '@/users/users.module';
import { Module } from '@nestjs/common';
import { AdminUserController } from './admin-user.controller';

@Module({
  imports: [UsersModule],
  controllers: [AdminUserController],
  providers: [],
})
export class AdminUserModule {}
