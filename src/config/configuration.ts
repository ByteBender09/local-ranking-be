export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
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

export interface ThrottleConfig {
  ttl: number;
  limit: number;
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
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME!,
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
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
});
