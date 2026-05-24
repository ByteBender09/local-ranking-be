import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Tour, User } from '../../database/entities';
import { MailService } from '../mail/mail.service';
import { UpdateBrandingDto } from './dto/branding.dto';

export interface BrandingResponse {
  brandName: string | null;
  brandShortName: string | null;
  brandLogoUrl: string | null;
  brandDescription: string;
  brandWebsiteUrl: string | null;
  brandContactEmail: string | null;
  brandEmailVerified: boolean;
  brandEmailVerifiedAt: Date | null;
  isComplete: boolean;
  pendingVerification: boolean;
}

const TOKEN_TTL_HOURS = 24;

@Injectable()
export class BrandingService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Tour) private readonly tours: Repository<Tour>,
    private readonly mail: MailService,
  ) {}

  async get(userId: string): Promise<BrandingResponse> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    return this.toResponse(user);
  }

  async update(
    userId: string,
    dto: UpdateBrandingDto,
  ): Promise<BrandingResponse> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    const prevEmail = user.brandContactEmail;
    if (dto.brandName !== undefined) user.brandName = dto.brandName;
    if (dto.brandShortName !== undefined)
      user.brandShortName = dto.brandShortName;
    if (dto.brandLogoUrl !== undefined)
      user.brandLogoUrl = dto.brandLogoUrl || null;
    if (dto.brandDescription !== undefined)
      user.brandDescription = dto.brandDescription;
    if (dto.brandWebsiteUrl !== undefined)
      user.brandWebsiteUrl = dto.brandWebsiteUrl || null;
    if (dto.brandContactEmail !== undefined)
      user.brandContactEmail = dto.brandContactEmail.toLowerCase();
    // Email changed → invalidate verification.
    if (
      dto.brandContactEmail !== undefined &&
      dto.brandContactEmail.toLowerCase() !== (prevEmail ?? '').toLowerCase()
    ) {
      user.brandEmailVerified = false;
      user.brandEmailVerifiedAt = null;
      user.brandVerificationToken = null;
      user.brandVerificationTokenExpiresAt = null;
    }
    const saved = await this.users.save(user);
    await this.syncOwnedTourProviders(saved);
    return this.toResponse(saved);
  }

  async sendVerification(userId: string): Promise<{ sent: boolean }> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (!user.brandName || !user.brandContactEmail) {
      throw new BadRequestException(
        'Hãy hoàn tất tên thương hiệu và email liên hệ trước khi xác minh',
      );
    }
    if (user.brandEmailVerified) {
      return { sent: false };
    }
    const token = randomBytes(48).toString('base64url');
    user.brandVerificationToken = token;
    user.brandVerificationTokenExpiresAt = new Date(
      Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );
    await this.users.save(user);
    await this.mail.sendBrandVerification(
      user.brandContactEmail,
      user.brandName,
      token,
    );
    return { sent: true };
  }

  async verifyToken(token: string): Promise<{ ok: boolean; reason?: string }> {
    if (!token) return { ok: false, reason: 'invalid' };
    const user = await this.users.findOne({
      where: { brandVerificationToken: token },
    });
    if (!user) return { ok: false, reason: 'invalid' };
    if (
      !user.brandVerificationTokenExpiresAt ||
      user.brandVerificationTokenExpiresAt < new Date()
    ) {
      return { ok: false, reason: 'expired' };
    }
    user.brandEmailVerified = true;
    user.brandEmailVerifiedAt = new Date();
    user.brandVerificationToken = null;
    user.brandVerificationTokenExpiresAt = null;
    const saved = await this.users.save(user);
    await this.syncOwnedTourProviders(saved);
    return { ok: true };
  }

  private async syncOwnedTourProviders(user: User): Promise<void> {
    if (!user.brandName) return;
    await this.tours
      .createQueryBuilder()
      .update(Tour)
      .set({
        provider: {
          name: user.brandName,
          shortName:
            user.brandShortName ?? user.handle.slice(0, 6).toUpperCase(),
          verified: user.role === 'admin' ? true : user.brandEmailVerified,
          logoUrl: user.brandLogoUrl ?? null,
        },
      })
      .where('owner_id = :id', { id: user.id })
      .execute();
  }

  // Tour creation gate: branding must have name + short name. Email verify is
  // optional but unlocks the blue tick.
  async assertCanCreateTour(userId: string): Promise<User> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (!user.brandName || !user.brandShortName) {
      throw new BadRequestException(
        'BRANDING_REQUIRED: Hãy hoàn tất tên thương hiệu trước khi tạo tour',
      );
    }
    return user;
  }

  private toResponse(user: User): BrandingResponse {
    const isComplete = Boolean(user.brandName && user.brandShortName);
    return {
      brandName: user.brandName,
      brandShortName: user.brandShortName,
      brandLogoUrl: user.brandLogoUrl,
      brandDescription: user.brandDescription ?? '',
      brandWebsiteUrl: user.brandWebsiteUrl,
      brandContactEmail: user.brandContactEmail,
      brandEmailVerified: user.brandEmailVerified,
      brandEmailVerifiedAt: user.brandEmailVerifiedAt,
      isComplete,
      pendingVerification:
        Boolean(user.brandVerificationToken) && !user.brandEmailVerified,
    };
  }
}

// Re-export NotFoundException so the controller can typecheck. (Kept for
// future use where 404 is preferable to throw locally.)
void NotFoundException;
