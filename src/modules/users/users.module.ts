import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, UserFollow } from '../../database/entities';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CheckInsModule } from '../check-ins/check-ins.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFollow]), CheckInsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
