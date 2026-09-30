import { createHash } from "node:crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { s3Client, S3_BUCKET } from "./s3-client";

// Content up to this size is stored directly in Postgres; anything larger
// goes to R2 under blobs/<hash>. Keeps small, frequently-read files (most
// source files) off the network round-trip to R2.
const INLINE_MAX_BYTES = 100_000;

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Stores `content` if it isn't already known (by hash) and returns the
 * hash. Content-addressing means identical files across snapshots and
 * projects are only ever stored once.
 */
export async function putBlob(content: string): Promise<string> {
  const hash = hashContent(content);

  const [existing] = await db
    .select({ hash: schema.blobs.hash })
    .from(schema.blobs)
    .where(eq(schema.blobs.hash, hash))
    .limit(1);
  if (existing) return hash;

  const size = Buffer.byteLength(content, "utf8");

  if (size <= INLINE_MAX_BYTES) {
    await db
      .insert(schema.blobs)
      .values({ hash, content, size })
      .onConflictDoNothing({ target: schema.blobs.hash });
    return hash;
  }

  const objectKey = `blobs/${hash}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      Body: content,
      ContentType: "text/plain; charset=utf-8",
    })
  );
  await db
    .insert(schema.blobs)
    .values({ hash, objectKey, size })
    .onConflictDoNothing({ target: schema.blobs.hash });
  return hash;
}

export async function getBlob(hash: string): Promise<string> {
  const [row] = await db
    .select()
    .from(schema.blobs)
    .where(eq(schema.blobs.hash, hash))
    .limit(1);

  if (!row) throw new Error(`Blob not found: ${hash}`);
  if (row.content !== null) return row.content;
  if (!row.objectKey) throw new Error(`Blob ${hash} has neither content nor objectKey`);

  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: row.objectKey })
  );
  return result.Body!.transformToString("utf-8");
}