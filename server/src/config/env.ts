import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  // HS256 signing secret for session JWTs. Must be long and random in production.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters."),
  // Selects the StorageProvider implementation (see src/lib/storage).
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  // Absolute path for the "local" driver's files. Unset = <server>/storage/uploads.
  STORAGE_ROOT: z.string().optional(),
  // Serve the built React app (client/dist) from this server - production single-container mode.
  SERVE_CLIENT_DIR: z.string().optional(),
  // Session cookie Secure flag. Defaults to on in production; set "false" only
  // to try a production build over plain http (e.g. docker-compose.prod.yml).
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  // Run the once-a-minute scheduled-content publisher in this process.
  SCHEDULED_PUBLISH_WORKER: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  // Requests slower than this are logged as warnings (latency budget).
  SLOW_REQUEST_MS: z.coerce.number().int().positive().default(100),
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";

export const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : isProduction;
