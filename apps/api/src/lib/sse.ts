import type { FastifyReply, FastifyRequest } from "fastify";
import { validateApiEnv } from "@vibe-code-ide/shared";


const env = validateApiEnv(Bun.env);

/**
 * Hijacks the reply and sets up an SSE stream. Hijacking means Fastify
 * won't try to send its own response, and it also means @fastify/cors's
 * usual header injection never runs — hence setting that header by hand
 * here too.
 */
export function startSse(request: FastifyRequest, reply: FastifyReply) {
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
    if (closed) return;
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function end() {
    if (!closed) reply.raw.end();
  }

  return { sendEvent, end, isClosed: () => closed };
}