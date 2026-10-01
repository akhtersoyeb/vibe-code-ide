import type { FastifyInstance } from "fastify";
import { userIdOf, findOwnedProject } from "../lib/requestContext";
import { validateApiEnv } from "@vibe-code-ide/shared"

const env = validateApiEnv(Bun.env)

interface ChatParams {
  id: string;
}

const idParamsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireAuth);

  fastify.post<{ Params: ChatParams }>(
    "/api/projects/:id/chat",
    { schema: idParamsSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      if (!project) return reply.notFound("Project not found");

      // Hand the raw response over to us — once hijacked, Fastify won't try
      // to send its own reply, which is required for a connection that
      // stays open and gets written to incrementally over time.
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        // Some proxies (ngrok included) buffer responses by default, which
        // would hold every chunk back until the stream ends.
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": env.CORS_ORIGIN,
        Vary: "Origin",
      });

      let closed = false;
      request.raw.on("close", () => {
        closed = true;
      });

      function sendEvent(event: string, data: unknown) {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      // Placeholder response, purely to prove the transport works
      // end-to-end. Phase 9 replaces this loop with real tool-calling
      // against the Anthropic API, streaming file_patch events instead of
      // plain text.
      const canned =
        "This is a placeholder response. The real AI agent arrives in " +
        "Phase 9 — for now this just proves the streaming pipe works.";

      for (const word of canned.split(" ")) {
        if (closed) break;
        sendEvent("text_delta", { text: word + " " });
        await sleep(40);
      }

      if (!closed) {
        sendEvent("done", { snapshotId: project.headSnapshotId });
        reply.raw.end();
      }
    }
  );
}