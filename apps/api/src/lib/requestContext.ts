import type { FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";

export function userIdOf(request: FastifyRequest): string {
  const { userId } = getAuth(request);
  if (!userId) throw new Error("requireAuth should have blocked this request");
  return userId;
}

/**
 * Looks up a project only if it belongs to the given user. Used everywhere
 * a project id comes from the URL, so a request for someone else's project
 * gets the same 404 as a nonexistent one — ids can't be probed either way.
 */
export async function findOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.ownerId, userId)))
    .limit(1);
  return project;
}