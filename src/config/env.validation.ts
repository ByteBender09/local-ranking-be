import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(4000),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),

  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  DB_SSL: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_POOL_SIZE: Joi.number().default(20),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  ADMIN_EMAILS: Joi.string().allow('').default(''),

  UPLOAD_DIR: Joi.string().default('/data/uploads'),
  UPLOAD_PUBLIC_URL: Joi.string().allow('').default(''),
  UPLOAD_MAX_BYTES: Joi.number().default(8 * 1024 * 1024),

  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_CALLBACK_URL: Joi.string().allow('').default(''),
  GOOGLE_SUCCESS_REDIRECT: Joi.string().allow('').default(''),
  GOOGLE_FAILURE_REDIRECT: Joi.string().allow('').default(''),

  INSTAGRAM_CLIENT_ID: Joi.string().allow('').default(''),
  INSTAGRAM_CLIENT_SECRET: Joi.string().allow('').default(''),
  INSTAGRAM_CALLBACK_URL: Joi.string().allow('').default(''),
  INSTAGRAM_SUCCESS_REDIRECT: Joi.string().allow('').default(''),
  INSTAGRAM_FAILURE_REDIRECT: Joi.string().allow('').default(''),

  THROTTLE_SHORT_TTL: Joi.number().default(1),
  THROTTLE_SHORT_LIMIT: Joi.number().default(20),
  THROTTLE_DEFAULT_TTL: Joi.number().default(60),
  THROTTLE_DEFAULT_LIMIT: Joi.number().default(120),
  THROTTLE_AUTH_TTL: Joi.number().default(60),
  THROTTLE_AUTH_LIMIT: Joi.number().default(10),

  BODY_LIMIT: Joi.string().default('1mb'),
});
