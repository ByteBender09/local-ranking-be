import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CheckIn,
  Review,
  Tour,
  User,
  Venue,
  Vote,
} from '../../database/entities';

export interface AdminOverview {
  users: { total: number; admins: number; business: number; regular: number };
  venues: { total: number };
  tours: { total: number; published: number; owned: number };
  engagement: { reviews: number; votes: number; checkIns: number };
  topVenues: Array<{ id: string; slug: string; name: string; upvotes: number; rating: number }>;
  recentUsers: Array<{
    id: string;
    handle: string;
    name: string;
    role: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Vote) private readonly votes: Repository<Vote>,
    @InjectRepository(CheckIn) private readonly checkIns: Repository<CheckIn>,
  ) {}

  async overview(): Promise<AdminOverview> {
    const [
      userTotal,
      userAdmins,
      userBusiness,
      venueTotal,
      tourTotal,
      tourPublished,
      tourOwned,
      reviewTotal,
      voteTotal,
      checkInTotal,
      topVenues,
      recentUsers,
    ] = await Promise.all([
      this.users.count(),
      this.users.countBy({ role: 'admin' }),
      this.users.countBy({ role: 'business' }),
      this.venues.count(),
      this.tours.count(),
      this.tours.countBy({ isPublished: true }),
      this.tours
        .createQueryBuilder('t')
        .where('t.owner_id IS NOT NULL')
        .getCount(),
      this.reviews.count(),
      this.votes.count(),
      this.checkIns.count(),
      this.venues.find({
        order: { upvotes: 'DESC' },
        take: 10,
        select: { id: true, slug: true, name: true, upvotes: true, rating: true },
      }),
      this.users.find({
        order: { createdAt: 'DESC' },
        take: 10,
        select: {
          id: true,
          handle: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      users: {
        total: userTotal,
        admins: userAdmins,
        business: userBusiness,
        regular: userTotal - userAdmins - userBusiness,
      },
      venues: { total: venueTotal },
      tours: { total: tourTotal, published: tourPublished, owned: tourOwned },
      engagement: {
        reviews: reviewTotal,
        votes: voteTotal,
        checkIns: checkInTotal,
      },
      topVenues,
      recentUsers,
    };
  }
}
