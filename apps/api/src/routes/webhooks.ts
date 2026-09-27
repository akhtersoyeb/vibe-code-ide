import type { FastifyInstance, FastifyRequest } from "fastify";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { validateApiEnv } from "@vibe-code-ide/shared";


const env = validateApiEnv(Bun.env);


// Fastify normally auto-parses application/json bodies, but Svix signature
// verification needs the exact, untouched request bytes. This augments the
// request type for the raw string this route's content-type parser stashes.
declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

interface ClerkEmailAddress {
  email_address: string;
}

interface ClerkUserEventData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserEventData;
}

export default async function webhookRoutes(fastify: FastifyInstance) {
  // Scoped to this plugin only: other routes keep Fastify's normal JSON
  // parsing. This one keeps the raw string so `wh.verify()` sees exactly
  // what Clerk signed.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request: FastifyRequest, body: string, done) => {
      request.rawBody = body;
      done(null, body);
    }
  );

  fastify.post("/api/webhooks/clerk", async (request, reply) => {
    const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      request.log.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
      return reply.code(500).send({ error: "Webhook not configured" });
    }

    const svixId = request.headers["svix-id"];
    const svixTimestamp = request.headers["svix-timestamp"];
    const svixSignature = request.headers["svix-signature"];

    if (
      typeof svixId !== "string" ||
      typeof svixTimestamp !== "string" ||
      typeof svixSignature !== "string" ||
      !request.rawBody
    ) {
      return reply.code(400).send({ error: "Missing svix headers or body" });
    }

    const wh = new Webhook(signingSecret);
    try {
      wh.verify(request.rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      request.log.warn({ err }, "clerk webhook signature verification failed");
      return reply.code(400).send({ error: "Invalid signature" });
    }

    const event = JSON.parse(request.rawBody) as ClerkWebhookEvent;

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const { id, email_addresses, first_name, last_name } = event.data;
        const email = email_addresses?.[0]?.email_address ?? "";
        const name = [first_name, last_name].filter(Boolean).join(" ") || null;

        await db
          .insert(schema.users)
          .values({ id, email, name })
          .onConflictDoUpdate({
            target: schema.users.id,
            set: { email, name },
          });
        break;
      }
      case "user.deleted": {
        if (event.data.id) {
          await db.delete(schema.users).where(eq(schema.users.id, event.data.id));
        }
        break;
      }
      default:
        request.log.info({ type: event.type }, "unhandled clerk webhook event");
    }

    return reply.code(200).send({ received: true });
  });
}