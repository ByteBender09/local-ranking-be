import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cluster from 'cluster';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { cpus } from 'os';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { types as pgTypes } from 'pg';
import { AppModule } from './app.module';
import { AppConfig, UploadConfig } from './config/configuration';
import { VenueImageRehostQueue } from './modules/uploads/venue-image-rehost.queue';

// `timestamp without time zone` columns (TypeORM's default for @CreateDateColumn)
// store UTC, but node-postgres parses them in the SERVER process's local
// timezone — so on a non-UTC host (e.g. dev in UTC+7) every timestamp comes
// back shifted, making "vừa xong" show as "7 giờ trước". Force these (OID 1114)
// to be interpreted as UTC. OID 1184 (timestamptz) is already correct.
pgTypes.setTypeParser(1114, (v: string) => new Date(`${v}Z`));

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
  Logger.log(
    `API ready at http://localhost:${appConfig.port}${cluster.isWorker ? ` (worker ${process.pid})` : ''}`,
    'Bootstrap',
  );

  const isResumeWorker = !cluster.isWorker || cluster.worker?.id === 1;
  if (isResumeWorker) {
    void app.get(VenueImageRehostQueue).resume();
  }
}

function startCluster(): void {
  const requested = parseInt(process.env.CLUSTER_WORKERS ?? '0', 10);
  const workers = requested > 0 ? requested : Math.max(1, cpus().length - 1);
  Logger.log(`Forking ${workers} worker(s)`, 'Cluster');
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (worker, code, signal) => {
    Logger.warn(
      `Worker ${worker.process.pid} died (code=${code} signal=${signal}) — respawning`,
      'Cluster',
    );
    cluster.fork();
  });
}

if (process.env.CLUSTER_MODE === 'true' && cluster.isPrimary) {
  startCluster();
} else {
  void bootstrap();
}
