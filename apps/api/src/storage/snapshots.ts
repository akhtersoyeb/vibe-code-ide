import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { putBlob, getBlob } from "./blobStore";

type SnapshotCreator = "ai" | "user" | "system";

interface CreateSnapshotInput {
  projectId: string;
  files: Record<string, string>; // path -> content
  createdBy: SnapshotCreator;
  parentId?: string;
  messageId?: string;
}

/**
 * Stores every file as a blob (deduped by content) and records a snapshot
 * whose manifest maps path -> blob hash. Also moves the project's
 * head_snapshot_id forward, so "the current files" is always one lookup
 * away rather than needing to walk history.
 */
export async function createSnapshot(input: CreateSnapshotInput) {
  const manifest: Record<string, string> = {};
  for (const [path, content] of Object.entries(input.files)) {
    manifest[path] = await putBlob(content);
  }

  const [snapshot] = await db
    .insert(schema.snapshots)
    .values({
      projectId: input.projectId,
      parentId: input.parentId,
      manifest,
      createdBy: input.createdBy,
      messageId: input.messageId,
    })
    .returning();

  await db
    .update(schema.projects)
    .set({ headSnapshotId: snapshot.id, updatedAt: new Date() })
    .where(eq(schema.projects.id, input.projectId));

  return snapshot;
}

/** Resolves a snapshot's manifest back into { path: content }. */
export async function resolveSnapshotFiles(
  snapshotId: string
): Promise<Record<string, string>> {
  const [snapshot] = await db
    .select({ manifest: schema.snapshots.manifest })
    .from(schema.snapshots)
    .where(eq(schema.snapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);

  const entries = await Promise.all(
    Object.entries(snapshot.manifest).map(
      async ([path, hash]) => [path, await getBlob(hash)] as const
    )
  );
  return Object.fromEntries(entries);
}