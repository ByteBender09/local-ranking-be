import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

/**
 * Authenticated (non-admin) image uploads — used by the mobile app to attach
 * photos to check-in memories. Mirrors the admin uploads endpoint but only
 * requires a valid JWT, not the admin role. Kept separate so the admin upload
 * surface is untouched.
 */
// NOTE: mounted at /media/upload (NOT /uploads) on purpose — `/uploads` is the
// ServeStatic root for serving uploaded files, so a controller there would be
// ambiguous with static file serving.
@Controller('media')
@UseGuards(JwtAuthGuard)
export class UserUploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const cfg = (
            req as Request & { app: { get: (k: string) => unknown } }
          ).app.get('uploadConfig') as UploadConfig | undefined;
          const dir = resolve(cfg?.diskPath ?? './uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const stamp = Date.now().toString(36);
          const rand = randomBytes(4).toString('hex');
          cb(
            null,
            `${stamp}-${rand}${extname(file.originalname).toLowerCase()}`,
          );
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

    const reqHost = req.get('host') ?? 'localhost';
    const isLocalRequest =
      /(^localhost(:|$))|(^127\.0\.0\.1)|(^192\.168\.)/.test(reqHost);
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
