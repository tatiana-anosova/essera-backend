import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  providers: [UsersService],
  controllers: [UsersController, AdminUsersController],
})
export class UsersModule {}
