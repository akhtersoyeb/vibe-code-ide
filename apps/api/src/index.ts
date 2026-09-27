import { build } from "./app";

import { validateApiEnv } from "@vibe-code-ide/shared";


const env = validateApiEnv(Bun.env);

const fastify = build();

const start = async () => {
  try {
    const port = Number(env.PORT ?? 8080);
    await fastify.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();