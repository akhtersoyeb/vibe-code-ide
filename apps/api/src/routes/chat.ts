import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { userIdOf, findOwnedProject } from "../lib/requestContext";
import { startSse } from "../lib/sse";
import { runAgentLoop } from "../agent/loop";
import { chatRateLimit, chatIpRateLimit } from "../lib/rateLimit";
import { acquireProjectLock, releaseProjectLock } from "../lib/concurrencyLock";
import { getCreditsBalance } from "../billing/ledger";

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

type Project = NonNullable<Awaited<ReturnType<typeof findOwnedProject>>>;

/**
 * Runs every check that should fail fast with a plain JSON response,
 * before an SSE stream is ever opened: rate limit -> project ownership ->
 * credit balance -> concurrency lock. Each of these has already sent a
 * reply itself on failure, so callers only need to check `ok`.
 */
async function guardTurn(
  request: FastifyRequest,
  reply: FastifyReply,
  projectId: string
): Promise<{ ok: true; userId: string; project: Project } | { ok: false }> {
  const userId = userIdOf(request);

  const [userLimit, ipLimit] = await Promise.all([
    chatRateLimit.limit(userId),
    chatIpRateLimit.limit(request.ip),
  ]);
  if (!userLimit.success || !ipLimit.success) {
    reply.code(429).send({ error: "Too many requests — slow down a bit." });
    return { ok: false };
  }

  const project = await findOwnedProject(projectId, userId);
  if (!project) {
    reply.notFound("Project not found");
    return { ok: false };
  }

  const balance = await getCreditsBalance(userId);
  if (balance <= 0) {
    reply.code(402).send({ error: "Out of credits" });
    return { ok: false };
  }

  const locked = await acquireProjectLock(project.id);
  if (!locked) {
    reply.code(409).send({ error: "This project is already running a turn" });
    return { ok: false };
  }

  return { ok: true, userId, project };
}

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireAuth);

  fastify.post<{ Params: ChatParams; Body: ChatBody }>(
    "/api/projects/:id/chat",
    { schema: chatSchema },
    async (request, reply) => {
      const guard = await guardTurn(request, reply, request.params.id);
      if (!guard.ok) return;
      const { userId, project } = guard;

      const { sendEvent, end } = startSse(request, reply);

      // Note: disconnecting doesn't currently cancel the underlying Gemini
      // call — the loop still runs to completion server-side, its events
      // just land nowhere. Fine for now; an AbortController wired to the
      // request's close event would fix it if abandoned-chat cost becomes
      // a problem.
      try {
        await runAgentLoop({
          projectId: project.id,
          userId,
          headSnapshotId: project.headSnapshotId,
          userMessage: request.body.message,
          reason: "chat",
          onEvent: (event) => sendEvent(event.type, event.data),
        });
      } catch (err) {
        sendEvent("error", {
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      } finally {
        await releaseProjectLock(project.id);
      }

      end();
    }
  );

  fastify.post<{ Params: ChatParams; Body: FixBody }>(
    "/api/projects/:id/chat/fix",
    { schema: fixSchema },
    async (request, reply) => {
      const guard = await guardTurn(request, reply, request.params.id);
      if (!guard.ok) return;
      const { userId, project } = guard;

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
          userId,
          headSnapshotId: project.headSnapshotId,
          userMessage: message,
          maxIterations: AUTO_FIX_MAX_ITERATIONS,
          reason: "fix",
          onEvent: (event) => sendEvent(event.type, event.data),
        });
      } catch (err) {
        sendEvent("error", {
          message: err instanceof Error ? err.message : "Something went wrong",
        });
      } finally {
        await releaseProjectLock(project.id);
      }

      end();
    }
  );
}