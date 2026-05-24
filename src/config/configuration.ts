export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  trustProxy: number;
  bodyLimit: string;
}

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  synchronize: boolean;
  logging: boolean;
  poolSize: number;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface AuthConfig {
  adminEmails: string[];
}

export interface UploadConfig {
  // Absolute path on disk where uploaded files are written. On Railway this
  // should be a mounted volume mount path like /data/uploads so files survive
  // deploys + restarts.
  diskPath: string;
  // Public origin (no trailing slash) at which uploaded files are served via
  // /uploads/<filename>. When empty, the request's own host is used.
  publicUrl: string;
  // Maximum file size in bytes — 8 MB by default.
  maxBytes: number;
}

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  successRedirect: string;
  failureRedirect: string;
}

export interface ThrottleTier {
  name: string;
  ttl: number;
  limit: number;
}

export interface ThrottleConfig {
  short: ThrottleTier;
  default: ThrottleTier;
  auth: ThrottleTier;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  auth: AuthConfig;
  upload: UploadConfig;
  google: OAuthClientConfig;
  instagram: OAuthClientConfig;
  throttle: ThrottleConfig;
}

export default (): RootConfig => ({
  app: {
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: parseInt(process.env.TRUST_PROXY ?? '0', 10),
    bodyLimit: process.env.BODY_LIMIT ?? '1mb',
  },
  database: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '20', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  auth: {
    adminEmails: (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
  upload: {
    diskPath: process.env.UPLOAD_DIR ?? '/data/uploads',
    publicUrl: process.env.UPLOAD_PUBLIC_URL ?? '',
    maxBytes: parseInt(process.env.UPLOAD_MAX_BYTES ?? '8388608', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
    successRedirect: process.env.GOOGLE_SUCCESS_REDIRECT ?? '',
    failureRedirect: process.env.GOOGLE_FAILURE_REDIRECT ?? '',
  },
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID ?? '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET ?? '',
    callbackUrl: process.env.INSTAGRAM_CALLBACK_URL ?? '',
    successRedirect: process.env.INSTAGRAM_SUCCESS_REDIRECT ?? '',
    failureRedirect: process.env.INSTAGRAM_FAILURE_REDIRECT ?? '',
  },
  throttle: {
    short: {
      name: 'short',
      ttl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '1', 10),
      limit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '20', 10),
    },
    default: {
      name: 'default',
      ttl: parseInt(process.env.THROTTLE_DEFAULT_TTL ?? '60', 10),
      limit: parseInt(process.env.THROTTLE_DEFAULT_LIMIT ?? '120', 10),
    },
    auth: {
      name: 'auth',
      ttl: parseInt(process.env.THROTTLE_AUTH_TTL ?? '60', 10),
      limit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '10', 10),
    },
  },
});
