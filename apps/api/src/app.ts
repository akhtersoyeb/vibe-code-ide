import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { getAuth } from "@clerk/fastify";
import clerkAuthPlugin from "./plugins/clerk";
import webhookRoutes from "./routes/webhooks";
import projectRoutes from "./routes/projects";
import { validateApiEnv } from "@vibe-code-ide/shared";


const env = validateApiEnv(Bun.env);

export function build() {
  const fastify = Fastify({
    logger:
      Bun.env.NODE_ENV === "production"
        ? true
        : { transport: { target: "pino-pretty" } },
  });

  fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  fastify.register(sensible);
  fastify.register(clerkAuthPlugin);
  fastify.register(webhookRoutes);
  fastify.register(projectRoutes);

  fastify.get("/health", async () => ({ status: "ok" }));

  // Example of a protected route using the requireAuth guard from
  // src/plugins/clerk.ts — remove once real routes exist.
  fastify.get(
    "/api/me",
    { preHandler: fastify.requireAuth },
    async (request) => {
      const { userId } = getAuth(request);
      return { userId };
    }
  );

  return fastify;
}