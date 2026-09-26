import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { validateApiEnv } from "@vibe-code-ide/shared";

config({
  path: ".env",
});

const env = validateApiEnv(process.env);

const directUrl = env.DATABASE_DIRECT_URL
if (!directUrl) {
  throw new Error("DIRECT_URL is not set (use Neon's non-pooled connection string)");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
  strict: true,
  verbose: true,
});