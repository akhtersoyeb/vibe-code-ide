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
  DATABASE_URL: z.url().min(1),
  DATABASE_DIRECT_URL: z.url().min(1),

  CLERK_SECRET_KEY: z.string().min(1),

  // R2_ACCOUNT_ID: z.string().min(1),
  // R2_ACCESS_KEY_ID: z.string().min(1),
  // R2_SECRET_ACCESS_KEY: z.string().min(1),
  // R2_BUCKET_NAME: z.string().min(1),

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