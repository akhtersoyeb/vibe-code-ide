import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { clerkPlugin, getAuth } from "@clerk/fastify";

import { validateApiEnv } from "@vibe-code-ide/shared";


const env = validateApiEnv(Bun.env);

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Registers Clerk's auth plugin and adds a `requireAuth` decorator you can
 * attach to any route as a preHandler:
 *
 *   fastify.get("/protected", { preHandler: fastify.requireAuth }, handler)
 */
export default fp(async function clerkAuthPlugin(fastify: FastifyInstance) {
  await fastify.register(clerkPlugin, {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });

  fastify.decorate(
    "requireAuth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = getAuth(request);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );
});