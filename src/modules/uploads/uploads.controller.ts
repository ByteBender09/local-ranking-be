import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { UploadCleanupService } from './upload-cleanup.service';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UploadConfig } from '../../config/configuration';

interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimetype: string;
}

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

// Admin-only, auth-gated bulk uploads (e.g. the venue importer) must not be
// rate-limited like public traffic — exempt this controller from the throttler.
@SkipThrottle()
@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UploadsController {
  constructor(
    private readonly config: ConfigService,
    private readonly cleanup: UploadCleanupService,
  ) {}

  // List every file in the upload volume root. Used by the orphan-cleanup
  // diagnostic to diff disk against DB references. Admin-only — the upload
  // volume is on a private Railway disk and we don't want to expose
  // directory listings publicly.
  @Get('list')
  async list(): Promise<{ files: string[]; total: number }> {
    const cfg = this.config.get<{ diskPath: string }>('upload');
    if (!cfg) return { files: [], total: 0 };
    const root = cfg.diskPath;
    let files: string[] = [];
    try {
      files = (await fs.readdir(root)).filter((f) => !f.startsWith('.'));
    } catch {
      // Volume not mounted in this environment — return empty.
    }
    return { files, total: files.length };
  }

  // Bulk unlink files from the upload volume. Used by one-off cleanup
  // scripts (e.g. _diag-hard-delete-suspicious.ts) that nuke a batch of
  // venues and need their CDN images gone too. UploadCleanupService is
  // strict: only paths under /uploads/ matching the safe-filename regex
  // are removed; foreign URLs are silently skipped.
  @Delete('by-urls')
  @HttpCode(200)
  async deleteByUrls(
    @Body() body: { urls?: unknown },
  ): Promise<{ removed: number; submitted: number }> {
    const urls = Array.isArray(body?.urls)
      ? (body.urls as unknown[]).filter((u): u is string => typeof u === 'string')
      : [];
    if (urls.length === 0) {
      throw new BadRequestException('Body must include urls: string[]');
    }
    const removed = await this.cleanup.deleteByUrls(urls);
    return { removed, submitted: urls.length };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const cfg = (req as Request & { app: { get: (k: string) => unknown } })
            .app.get('uploadConfig') as UploadConfig | undefined;
          const dir = resolve(cfg?.diskPath ?? './uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const stamp = Date.now().toString(36);
          const rand = randomBytes(4).toString('hex');
          cb(null, `${stamp}-${rand}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED.has(file.mimetype)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('Missing file');
    const cfg = this.config.get<UploadConfig>('upload')!;

    // Prefer the request's own origin when developing locally — the
    // configured publicUrl typically points to production, so dev uploads
    // would return a prod URL that 404s because the file only exists on
    // the dev disk.
    const reqHost = req.get('host') ?? 'localhost';
    const isLocalRequest = /(^localhost(:|$))|(^127\.0\.0\.1)|(^192\.168\.)/.test(
      reqHost,
    );
    const origin =
      isLocalRequest || !cfg.publicUrl
        ? `${req.protocol}://${reqHost}`
        : cfg.publicUrl;
    const publicPath = `/uploads/${file.filename}`;
    return {
      url: `${origin.replace(/\/$/, '')}${publicPath}`,
      path: join(cfg.diskPath, file.filename),
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
