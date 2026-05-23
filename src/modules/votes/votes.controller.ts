import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CastVoteDto } from './dto/cast-vote.dto';
import { VoteResult, VotesService } from './votes.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class VotesController {
  constructor(private readonly votes: VotesService) {}

  @Post('venues/slug/:slug/vote')
  cast(
    @Param('slug') slug: string,
    @Body() body: CastVoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VoteResult> {
    return this.votes.cast(slug, user.id, body.value);
  }

  @Get('me/votes')
  myVotes(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ venueId: string; value: 1 | -1 }[]> {
    return this.votes.listUserVotes(user.id);
  }
}
