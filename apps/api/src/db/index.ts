import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { validateApiEnv } from "@vibe-code-ide/shared";

const env = validateApiEnv(Bun.env);

const connectionString = env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `prepare: false` is required when connecting through Neon's pooled
// endpoint: PgBouncer in transaction mode doesn't support named prepared
// statements. It's harmless if you ever point this at a direct connection.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };