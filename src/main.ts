import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig, UploadConfig } from './config/configuration';

const REQUEST_TIMEOUT_MS = 15_000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app')!;

  // Trust the proxy hop count so req.ip resolves to the real client when behind
  // a load balancer / CDN. 0 = direct, 1 = single proxy, etc.
  app.set('trust proxy', appConfig.trustProxy);

  // Expose the resolved upload config on the Express app so the multer
  // `destination` callbacks (which only have access to `req`, not Nest DI)
  // write to the SAME directory ServeStatic serves from. Without this they
  // fall back to `./uploads` (ephemeral container disk) while files are served
  // from the mounted volume (e.g. /data/uploads) → every uploaded image 404s.
  app.set('uploadConfig', config.get<UploadConfig>('upload'));

  app.use(
    helmet({
      contentSecurityPolicy:
        appConfig.nodeEnv === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // Hard cap request payloads. Anything bigger gets rejected before parsing
  // so a flood of giant bodies can't exhaust memory.
  app.use(json({ limit: appConfig.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: appConfig.bodyLimit }));

  // Drop slow/hung requests so a Slowloris-style attack can't pin sockets.
  app.use((req: any, res: any, next: any) => {
    req.setTimeout(REQUEST_TIMEOUT_MS);
    res.setTimeout(REQUEST_TIMEOUT_MS);
    next();
  });

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(appConfig.port);
  Logger.log(`API ready at http://localhost:${appConfig.port}`, 'Bootstrap');
}

void bootstrap();
