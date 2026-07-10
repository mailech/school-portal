import { z } from 'zod';

const boolish = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .or(z.boolean())
    .default(def);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ_DEFAULT: z.string().default('Asia/Kolkata'),
  CURRENCY: z.string().default('INR'),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: boolish(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  ARGON2_MEMORY_KIB: z.coerce.number().int().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().default(1),

  PGBOSS_SCHEMA: z.string().default('pgboss'),
  PGBOSS_ARCHIVE_COMPLETED_AFTER_SEC: z.coerce.number().int().default(86400),
  PGBOSS_DELETE_AFTER_DAYS: z.coerce.number().int().default(7),

  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  API_GLOBAL_PREFIX: z.string().default('api'),
  THROTTLE_TTL_SEC: z.coerce.number().int().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().default(100),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().default(8),

  DEV_ENDPOINTS_ENABLED: boolish(false),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  isProd: boolean;
  timezone: string;
  currency: string;
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  cookie: {
    domain: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };
  argon2: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  api: {
    port: number;
    globalPrefix: string;
    webOrigin: string;
  };
  queue: {
    schema: string;
    archiveCompletedAfterSec: number;
    deleteAfterDays: number;
  };
  throttle: {
    ttlSec: number;
    limit: number;
    authLimit: number;
  };
  devEndpointsEnabled: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    isProd: e.NODE_ENV === 'production',
    timezone: e.TZ_DEFAULT,
    currency: e.CURRENCY,
    databaseUrl: e.DATABASE_URL,
    jwt: {
      accessSecret: e.JWT_ACCESS_SECRET,
      accessTtl: e.JWT_ACCESS_TTL,
      refreshSecret: e.JWT_REFRESH_SECRET,
      refreshTtl: e.JWT_REFRESH_TTL,
    },
    cookie: {
      domain: e.COOKIE_DOMAIN,
      secure: e.COOKIE_SECURE,
      sameSite: e.COOKIE_SAMESITE,
    },
    argon2: {
      memoryCost: e.ARGON2_MEMORY_KIB,
      timeCost: e.ARGON2_TIME_COST,
      parallelism: e.ARGON2_PARALLELISM,
    },
    api: {
      port: e.API_PORT,
      globalPrefix: e.API_GLOBAL_PREFIX,
      webOrigin: e.WEB_ORIGIN,
    },
    queue: {
      schema: e.PGBOSS_SCHEMA,
      archiveCompletedAfterSec: e.PGBOSS_ARCHIVE_COMPLETED_AFTER_SEC,
      deleteAfterDays: e.PGBOSS_DELETE_AFTER_DAYS,
    },
    throttle: {
      ttlSec: e.THROTTLE_TTL_SEC,
      limit: e.THROTTLE_LIMIT,
      authLimit: e.AUTH_THROTTLE_LIMIT,
    },
    devEndpointsEnabled: e.DEV_ENDPOINTS_ENABLED,
  };
}
