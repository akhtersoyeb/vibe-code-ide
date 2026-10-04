import { sql, eq } from "drizzle-orm";
import { db, schema } from "../db";

export async function getCreditsBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ creditsBalance: schema.users.creditsBalance })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.creditsBalance ?? 0;
}

/** Converts a Gemini token count into a whole-number credit cost. Minimum
 * of 1 so even a short exchange registers as real usage. These are usage
 * quota units, not a real-money cost — the mechanism is the same either
 * way, only the meaning of "1 credit" would change later. */
export function tokensToCredits(totalTokens: number): number {
  return Math.max(1, Math.ceil(totalTokens / 1000));
}

/** Debits credits and records the ledger entry in one transaction, so the
 * running balance and the audit trail can never drift apart. */
export async function debitCredits(
  userId: string,
  projectId: string,
  credits: number,
  reason: string
): Promise<void> {
  if (credits <= 0) return;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ creditsBalance: sql`${schema.users.creditsBalance} - ${credits}` })
      .where(eq(schema.users.id, userId));

    await tx.insert(schema.usageLedger).values({
      userId,
      projectId,
      deltaCredits: -credits,
      reason,
    });
  });
}