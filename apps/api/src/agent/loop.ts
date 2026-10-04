import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import type { Content, Part } from "@google/genai";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { createSnapshot, resolveSnapshotFiles } from "../storage/snapshots";
import { toolDeclarations, runTool, type ToolContext } from "./tools";
import { SYSTEM_INSTRUCTION, loadHistory } from "./context";
import { validateApiEnv } from '@vibe-code-ide/shared'
import { debitCredits, tokensToCredits } from "../billing/ledger";


const env = validateApiEnv(Bun.env)

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// An alias that always points at the current flash model, so this doesn't
// go stale as Google ships new versions. Pin an exact version instead if
// you need reproducible behavior.
const MODEL = "gemini-flash-latest";

const DEFAULT_MAX_ITERATIONS = 15;

export type AgentEvent =
  | { type: "text_delta"; data: { text: string } }
  | { type: "file_patch"; data: { path: string; op: "write" | "delete"; content?: string } }
  | { type: "done"; data: { snapshotId: string | null; summary: string } }
  | { type: "error"; data: { message: string } };

interface RunAgentLoopParams {
  projectId: string;
  userId: string;
  headSnapshotId: string | null;
  userMessage: string;
  /** Just a label for the usage_ledger row ("chat" vs "fix") — doesn't
   * affect how the loop runs. */
  reason: string;
  onEvent: (event: AgentEvent) => void;
  /** Overridden to a tighter cap (e.g. 3) for the auto-fix endpoint, which
   * should fail fast rather than wander for 15 rounds on a bug it can't
   * actually fix. */
  maxIterations?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fakes a typing effect for the user-facing text in each round. Real
// token-level streaming and multi-step function calling don't mix well —
// newer Gemini models attach a thoughtSignature to function-call parts that
// must be forwarded byte-for-byte on the next turn, which is fragile to
// reconstruct from a token stream. Using the complete response per round
// and chunking it cosmetically is far more reliable.
async function emitTyped(text: string, onEvent: (e: AgentEvent) => void) {
  for (const word of text.split(" ")) {
    onEvent({ type: "text_delta", data: { text: word + " " } });
    await sleep(25);
  }
}

async function billForTurn(
  userId: string,
  projectId: string,
  totalTokens: number,
  reason: string
) {
  if (totalTokens <= 0) return;
  try {
    await debitCredits(userId, projectId, tokensToCredits(totalTokens), reason);
  } catch (err) {
    // A billing hiccup shouldn't mask the agent's actual result — the
    // user still gets their response either way, this just means the
    // ledger under-counts this one turn.
    console.error("debitCredits failed", err);
  }
}

export async function runAgentLoop({
  projectId,
  userId,
  headSnapshotId,
  userMessage,
  reason,
  onEvent,
  maxIterations = DEFAULT_MAX_ITERATIONS,
}: RunAgentLoopParams): Promise<void> {
  const history = await loadHistory(projectId);

  await db.insert(schema.messages).values({
    projectId,
    role: "user",
    content: { text: userMessage },
  });

  const files = headSnapshotId ? await resolveSnapshotFiles(headSnapshotId) : {};
  let filesChanged = false;
  let totalTokens = 0;

  const toolCtx: ToolContext = {
    files,
    onPatch: (path, op, content) => {
      filesChanged = true;
      onEvent({ type: "file_patch", data: { path, op, content } });
    },
  };

  const contents: Content[] = [...history, { role: "user", parts: [{ text: userMessage }] }];
  let finalSummary = "Done.";

  try {
    for (let i = 0; i < maxIterations; i++) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: toolDeclarations }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });

      totalTokens += response.usageMetadata?.totalTokenCount ?? 0;

      const modelContent = response.candidates?.[0]?.content;
      if (!modelContent) throw new Error("Gemini returned an empty response");

      if (response.text) {
        await emitTyped(response.text, onEvent);
      }

      const calls = response.functionCalls ?? [];

      if (calls.length === 0) {
        finalSummary = response.text || "Done.";
        break;
      }

      // Pushed verbatim (not reconstructed) so any thoughtSignature on
      // function-call parts survives into the next round unmodified.
      contents.push(modelContent);

      const responseParts: Part[] = [];
      let calledFinish = false;

      for (const call of calls) {
        let result: Record<string, unknown>;
        try {
          result = runTool(call.name ?? "", call.args ?? {}, toolCtx);
        } catch (err) {
          // Feed the error back as the tool's result so the model can see
          // what went wrong and correct itself, instead of this request
          // crashing outright.
          result = { error: err instanceof Error ? err.message : "Tool failed" };
        }

        responseParts.push({
          functionResponse: {
            name: call.name ?? "",
            ...(call.id ? { id: call.id } : {}),
            response: result,
          },
        });

        if (call.name === "finish") {
          calledFinish = true;
          finalSummary = (call.args as { summary?: string } | undefined)?.summary ?? "Done.";
        }
      }

      contents.push({ role: "user", parts: responseParts });

      if (calledFinish) break;

      if (i === maxIterations - 1) {
        finalSummary = "Reached the step limit — here's what changed so far.";
      }
    }
  } catch (err) {
    // Gemini already consumed quota for whatever rounds ran before the
    // failure, so bill for those even though this turn didn't finish.
    await billForTurn(userId, projectId, totalTokens, reason);
    onEvent({
      type: "error",
      data: { message: err instanceof Error ? err.message : "The agent failed unexpectedly" },
    });
    return;
  }

  await billForTurn(userId, projectId, totalTokens, reason);

  const [assistantMessage] = await db
    .insert(schema.messages)
    .values({ projectId, role: "assistant", content: { text: finalSummary } })
    .returning();

  let snapshotId = headSnapshotId;

  if (filesChanged) {
    const snapshot = await createSnapshot({
      projectId,
      files,
      createdBy: "ai",
      parentId: headSnapshotId ?? undefined,
      messageId: assistantMessage.id,
    });
    snapshotId = snapshot.id;

    await db
      .update(schema.messages)
      .set({ snapshotId: snapshot.id })
      .where(eq(schema.messages.id, assistantMessage.id));
  }

  onEvent({ type: "done", data: { snapshotId, summary: finalSummary } });
}
