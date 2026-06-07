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
  // Used by the mobile OAuth flow only. When Google start was hit with
  // `?mobile=1`, the callback redirects here instead of `successRedirect`,
  // with the issued JWT appended as `?token=<jwt>`. The Flutter app captures
  // this via flutter_web_auth_2's custom-scheme callback.
  mobileSuccessRedirect: string;
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

export interface MailConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  appPublicUrl: string;
  backendPublicUrl: string;
}

export interface AiConfig {
  openrouterApiKey: string;
  parserModel: string;
  rerankerModel: string;
  tripPlannerModel: string;
  cacheTtlSeconds: number;
  requestTimeoutMs: number;
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
  mail: MailConfig;
  ai: AiConfig;
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
    mobileSuccessRedirect:
      process.env.GOOGLE_MOBILE_SUCCESS_REDIRECT ??
      'homnaydidau://auth/callback',
  },
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID ?? '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET ?? '',
    callbackUrl: process.env.INSTAGRAM_CALLBACK_URL ?? '',
    successRedirect: process.env.INSTAGRAM_SUCCESS_REDIRECT ?? '',
    failureRedirect: process.env.INSTAGRAM_FAILURE_REDIRECT ?? '',
    mobileSuccessRedirect: '',
  },
  throttle: {
    short: {
      name: 'short',
      ttl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '1', 10),
      limit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '40', 10),
    },
    default: {
      name: 'default',
      ttl: parseInt(process.env.THROTTLE_DEFAULT_TTL ?? '60', 10),
      limit: parseInt(process.env.THROTTLE_DEFAULT_LIMIT ?? '240', 10),
    },
    auth: {
      name: 'auth',
      ttl: parseInt(process.env.THROTTLE_AUTH_TTL ?? '60', 10),
      limit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '30', 10),
    },
  },
  ai: {
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
    parserModel: process.env.AI_PARSER_MODEL ?? 'openai/gpt-4o-mini',
    rerankerModel: process.env.AI_RERANKER_MODEL ?? 'openai/gpt-4o-mini',
    tripPlannerModel: process.env.AI_TRIP_PLANNER_MODEL ?? 'openai/gpt-4o-mini',
    cacheTtlSeconds: parseInt(process.env.AI_CACHE_TTL_SECONDS ?? `${7 * 24 * 60 * 60}`, 10),
    requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '20000', 10),
  },
  mail: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    fromEmail: process.env.RESEND_FROM_EMAIL ?? 'noreply@homnaydidau.local',
    fromName: process.env.RESEND_FROM_NAME ?? 'Hôm Nay Đi Đâu',
    appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
    backendPublicUrl:
      process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:4000',
  },
});
