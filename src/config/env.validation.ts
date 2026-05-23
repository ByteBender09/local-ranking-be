import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(4000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_POOL_SIZE: Joi.number().default(20),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

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

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(120),
});
