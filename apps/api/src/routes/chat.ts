import type { FastifyInstance } from "fastify";
import { userIdOf, findOwnedProject } from "../lib/requestContext";
import { startSse } from "../lib/sse";
import { runAgentLoop } from "../agent/loop";

interface ChatParams {
  id: string;
}

interface ChatBody {
  message: string;
}

interface FixBody {
  error: string;
}

const paramsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
};

const chatSchema = {
  ...paramsSchema,
  body: {
    type: "object",
    required: ["message"],
    additionalProperties: false,
    properties: {
      message: { type: "string", minLength: 1, maxLength: 4000 },
    },
  },
};

const fixSchema = {
  ...paramsSchema,
  body: {
    type: "object",
    required: ["error"],
    additionalProperties: false,
    properties: {
      error: { type: "string", minLength: 1, maxLength: 4000 },
    },
  },
};

const AUTO_FIX_MAX_ITERATIONS = 3;

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireAuth);

  fastify.post<{ Params: ChatParams; Body: ChatBody }>(
    "/api/projects/:id/chat",
    { schema: chatSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      if (!project) return reply.notFound("Project not found");

      const { sendEvent, end } = startSse(request, reply);

      // Note: disconnecting doesn't currently cancel the underlying Gemini
      // call — the loop still runs to completion server-side, its events
      // just land nowhere. Fine for now; an AbortController wired to the
      // request's close event would fix it if abandoned-chat cost becomes
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

      end();
    }
  );

  fastify.post<{ Params: ChatParams; Body: FixBody }>(
    "/api/projects/:id/chat/fix",
    { schema: fixSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      if (!project) return reply.notFound("Project not found");

      const { sendEvent, end } = startSse(request, reply);

      // The framing (and the tight iteration cap) live here, server-side —
      // the client only ever has to send the raw error text.
      const message =
        "The app has an error. Fix it with the smallest possible change — " +
        "don't add new features or refactor unrelated code.\n\nError:\n" +
        request.body.error;

      try {
        await runAgentLoop({
          projectId: project.id,
          headSnapshotId: project.headSnapshotId,
          userMessage: message,
          maxIterations: AUTO_FIX_MAX_ITERATIONS,
          onEvent: (event) => sendEvent(event.type, event.data),
        });
      } catch (err) {
        sendEvent("error", {
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      }

      end();
    }
  );
}