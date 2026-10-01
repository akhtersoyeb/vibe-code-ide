import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import clerkAuthPlugin from "./plugins/clerk";
import webhookRoutes from "./routes/webhooks";
import projectRoutes from "./routes/projects";
import chatRoutes from "./routes/chat";
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
  fastify.register(chatRoutes);

  fastify.get("/health", async () => ({ status: "ok" }));

  return fastify;
}