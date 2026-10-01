import type { FastifyInstance } from "fastify";
import { userIdOf, findOwnedProject } from "../lib/requestContext";
import { runAgentLoop } from "../agent/loop";
import { validateApiEnv } from '@vibe-code-ide/shared'


const env = validateApiEnv(Bun.env)

interface ChatParams {
  id: string;
}

interface ChatBody {
  message: string;
}

const chatSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  body: {
    type: "object",
    required: ["message"],
    additionalProperties: false,
    properties: {
      message: { type: "string", minLength: 1, maxLength: 4000 },
    },
  },
};

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireAuth);

  fastify.post<{ Params: ChatParams; Body: ChatBody }>(
    "/api/projects/:id/chat",
    { schema: chatSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      if (!project) return reply.notFound("Project not found");

      // Hand the raw response over to us — once hijacked, Fastify won't try
      // to send its own reply, and @fastify/cors's header injection is
      // bypassed too, hence setting it by hand below.
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": env.CORS_ORIGIN,
        Vary: "Origin",
      });

      let closed = false;
      request.raw.on("close", () => {
        closed = true;
      });

      function sendEvent(event: string, data: unknown) {
        if (closed) return;
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      // Note: disconnecting doesn't currently cancel the underlying Gemini
      // call — the loop still runs to completion server-side, its events
      // just land nowhere. Fine for now; an AbortController wired to this
      // close event would fix it if API cost from abandoned chats becomes
      // a problem.
      try {
        await runAgentLoop({
          projectId: project.id,
          headSnapshotId: project.headSnapshotId,
          userMessage: request.body.message,
          onEvent: (event) => sendEvent(event.type, event.data),
        });
      } catch (err) {
        sendEvent("error", {
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      }

      if (!closed) reply.raw.end();
    }
  );
}