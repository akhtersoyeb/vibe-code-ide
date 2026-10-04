import { validateApiEnv } from "@vibe-code-ide/shared";
import { Redis } from "@upstash/redis";


const env = validateApiEnv(Bun.env);


const url = env.UPSTASH_REDIS_REST_URL;
const token = env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
}

export const redis = new Redis({ url, token });