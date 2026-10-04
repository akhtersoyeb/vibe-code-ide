import { redis } from "./redis";

// A stuck/crashed process shouldn't be able to hold the lock forever — this
// is well above how long any single turn should realistically take.
const LOCK_TTL_SECONDS = 120;

function lockKey(projectId: string): string {
  return `project:${projectId}:running`;
}

/** Atomic try-lock: returns true if the lock was acquired, false if the
 * project already has a turn in progress. */
export async function acquireProjectLock(projectId: string): Promise<boolean> {
  const result = await redis.set(lockKey(projectId), "1", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

export async function releaseProjectLock(projectId: string): Promise<void> {
  await redis.del(lockKey(projectId));
}