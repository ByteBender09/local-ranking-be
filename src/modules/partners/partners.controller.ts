import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { MailService } from '../mail/mail.service';
import { PartnerInquiryDto } from './dto/partner-inquiry.dto';

@Controller('partners')
export class PartnersController {
  constructor(private readonly mail: MailService) {}

  // Public endpoint — anyone can submit a partner inquiry. Tighter per-IP
  // limit than the global default so the inbox doesn't get spammed: 5
  // submissions per 10 minutes.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60 * 1000 } })
  @HttpCode(202)
  @Post('inquiry')
  async submit(@Body() dto: PartnerInquiryDto): Promise<{ ok: true }> {
    await this.mail.sendPartnerInquiry(dto);
    return { ok: true };
  }
}
