import { validateApiEnv } from "@vibe-code-ide/shared";
import Fastify from "fastify";

const env = validateApiEnv(Bun.env);

const app = Fastify({
  logger: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
  };
});

await app.listen({
  port: 3000,
  host: "0.0.0.0",
});