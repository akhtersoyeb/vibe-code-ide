import { z } from "zod";

/**
 * Environment variables required by the web application.
 */
export const webEnvSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  VITE_API_BASE_URL: z.url(),
});

/**
 * Environment variables required by the API.
 */
export const apiEnvSchema = z.object({
  CORS_ORIGIN: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.url().min(1),
  DATABASE_DIRECT_URL: z.url().min(1),


  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  AWS_ENDPOINT_URL_S3: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_BUCKET_NAME: z.string().min(1),

  // UPSTASH_REDIS_REST_URL: z.url(),
  // UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function validateWebEnv(env: Record<string, unknown>) {
  const result = webEnvSchema.safeParse(env);

  if (!result.success) {
    console.error("❌ Invalid web environment variables:");
    console.error(z.prettifyError(result.error));
    throw new Error(
      `Invalid WEB environment variables:\n${z.prettifyError(result.error)}`
    );
  }

  return result.data;
}

export function validateApiEnv(env: Record<string, unknown>) {
  const result = apiEnvSchema.safeParse(env);

  if (!result.success) {
    console.error("❌ Invalid API environment variables:");
    console.error(z.prettifyError(result.error));
    throw new Error(
      `Invalid API environment variables:\n${z.prettifyError(result.error)}`
    );
  }

  return result.data;
}