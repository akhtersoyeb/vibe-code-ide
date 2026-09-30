import type { FastifyInstance, FastifyRequest } from "fastify";
import { clerkClient, getAuth } from "@clerk/fastify";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { createSnapshot, resolveSnapshotFiles } from "../storage/snapshots";
import { TEMPLATES } from "../storage/templates";

const TEMPLATE_NAMES = Object.keys(TEMPLATES);

interface CreateProjectBody {
  name: string;
  template?: string;
}

interface PutFilesBody {
  baseSnapshotId: string;
  files: Record<string, string>;
}

interface ProjectParams {
  id: string;
}

const createProjectSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      template: { type: "string", enum: TEMPLATE_NAMES },
    },
  },
};

// Rejects malformed ids up front; otherwise Postgres throws
// "invalid input syntax for type uuid" and the client sees a 500.
const idParamsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
};

const putFilesSchema = {
  ...idParamsSchema,
  body: {
    type: "object",
    required: ["baseSnapshotId", "files"],
    additionalProperties: false,
    properties: {
      baseSnapshotId: { type: "string", format: "uuid" },
      files: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
  },
};

function userIdOf(request: FastifyRequest): string {
  const { userId } = getAuth(request);
  if (!userId) throw new Error("requireAuth should have blocked this request");
  return userId;
}

// projects.owner_id is a foreign key to users.id. Normally the Clerk webhook
// has already created the row, but if it hasn't (account created before the
// webhook existed, delayed delivery, ...) pull the user from Clerk directly.
async function ensureUserRow(userId: string) {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (existing) return;

  const user = await clerkClient.users.getUser(userId);
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  await db
    .insert(schema.users)
    .values({ id: userId, email, name })
    .onConflictDoNothing({ target: schema.users.id });
}

async function findOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.ownerId, userId)))
    .limit(1);
  return project;
}

export default async function projectRoutes(fastify: FastifyInstance) {
  // Every route in this plugin requires a signed-in user. Runs after Clerk's
  // own preHandler, which is what populates getAuth().
  fastify.addHook("preHandler", fastify.requireAuth);

  fastify.get("/api/projects", async (request) => {
    const userId = userIdOf(request);
    return db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.ownerId, userId))
      .orderBy(desc(schema.projects.updatedAt));
  });

  fastify.post<{ Body: CreateProjectBody }>(
    "/api/projects",
    { schema: createProjectSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const name = request.body.name.trim();
      if (!name) return reply.badRequest("Project name is required");

      await ensureUserRow(userId);

      const template = request.body.template ?? "vite-react";

      const [project] = await db
        .insert(schema.projects)
        .values({ ownerId: userId, name, template })
        .returning();

      // Seed the project with its starter template as the first snapshot,
      // so it has real files from the moment it's created.
      await createSnapshot({
        projectId: project.id,
        files: TEMPLATES[template],
        createdBy: "system",
      });

      const seeded = await findOwnedProject(project.id, userId);
      return reply.code(201).send(seeded);
    }
  );

  fastify.get<{ Params: ProjectParams }>(
    "/api/projects/:id",
    { schema: idParamsSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      // Same 404 whether it doesn't exist or belongs to someone else, so
      // ids of other users' projects can't be probed.
      if (!project) return reply.notFound("Project not found");
      return project;
    }
  );

  fastify.get<{ Params: ProjectParams }>(
    "/api/projects/:id/files",
    { schema: idParamsSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      if (!project) return reply.notFound("Project not found");

      if (!project.headSnapshotId) {
        return { snapshotId: null, files: {} };
      }

      const files = await resolveSnapshotFiles(project.headSnapshotId);
      return { snapshotId: project.headSnapshotId, files };
    }
  );

  fastify.put<{ Params: ProjectParams; Body: PutFilesBody }>(
    "/api/projects/:id/files",
    { schema: putFilesSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const project = await findOwnedProject(request.params.id, userId);
      if (!project) return reply.notFound("Project not found");

      // Optimistic concurrency: reject if the project moved on since the
      // client last fetched it (e.g. another tab, or later, the AI agent).
      if (project.headSnapshotId !== request.body.baseSnapshotId) {
        return reply.code(409).send({
          error: "Project has changed since you last loaded it",
          headSnapshotId: project.headSnapshotId,
        });
      }

      const snapshot = await createSnapshot({
        projectId: project.id,
        files: request.body.files,
        createdBy: "user",
        parentId: project.headSnapshotId ?? undefined,
      });

      return reply.send({ snapshotId: snapshot.id });
    }
  );

  fastify.delete<{ Params: ProjectParams }>(
    "/api/projects/:id",
    { schema: idParamsSchema },
    async (request, reply) => {
      const userId = userIdOf(request);
      const deleted = await db
        .delete(schema.projects)
        .where(
          and(eq(schema.projects.id, request.params.id), eq(schema.projects.ownerId, userId))
        )
        .returning({ id: schema.projects.id });

      if (deleted.length === 0) return reply.notFound("Project not found");
      return reply.code(204).send();
    }
  );
}