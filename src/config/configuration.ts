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
