import { Controller, Get, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { Public } from '../../common/decorators/public.decorator';
import { UploadConfig, MailConfig } from '../../config/configuration';
import { VenuesService } from '../venues/venues.service';

// Open Graph image renderer.
//
// Venue photos are stored as WebP (the importer transcodes to WebP for size).
// Facebook/Messenger silently DROP WebP `og:image`s — which is why link
// previews lost their image there while Zalo (which accepts WebP) still showed
// it. This endpoint serves a JPEG rendition of a venue's lead photo at the
// canonical 1200×630 OG aspect, so the social card shows the real photo on
// every platform. Public + un-throttled so the crawlers (facebookexternalhit,
// etc.) can always fetch it, and heavily cached since the source rarely changes.
@Controller('og')
@Public()
@SkipThrottle()
export class OgController {
  constructor(
    private readonly venues: VenuesService,
    private readonly config: ConfigService,
  ) {}

  @Get('venue/:slug')
  async venueImage(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    const fallback = `${this.siteUrl()}/opengraph-image.png`;
    try {
      const venue = await this.venues.getBySlug(slug);
      const src = venue.images?.[0];
      const input = src ? await this.loadImage(src) : null;
      if (!input) return void res.redirect(302, fallback);

      const jpeg = await sharp(input)
        .resize(1200, 630, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

      res
        .set('Content-Type', 'image/jpeg')
        // Cache hard at the CDN/crawler — re-fetch is cheap and source is stable.
        .set('Cache-Control', 'public, max-age=86400, s-maxage=604800')
        .send(jpeg);
    } catch {
      // Unknown slug, unreachable image, decode failure → site default card.
      res.redirect(302, fallback);
    }
  }

  // Resolve a stored image to bytes. Files uploaded through /admin/uploads live
  // on the local volume under /uploads/<file>; read those straight off disk and
  // only fall back to an HTTP fetch for anything else.
  private async loadImage(src: string): Promise<Buffer | null> {
    const onDisk = src.match(/\/uploads\/([^/?#]+)$/);
    if (onDisk) {
      const upload = this.config.get<UploadConfig>('upload')!;
      const path = join(resolve(upload.diskPath), onDisk[1]);
      if (existsSync(path)) return readFile(path);
    }
    if (/^https?:\/\//i.test(src)) {
      const r = await fetch(src);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    }
    return null;
  }

  private siteUrl(): string {
    const mail = this.config.get<MailConfig>('mail');
    return (mail?.appPublicUrl ?? 'https://www.homnaydidau.xyz').replace(
      /\/$/,
      '',
    );
  }
}
