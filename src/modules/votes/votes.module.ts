import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vote, Venue } from '../../database/entities';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vote, Venue])],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
