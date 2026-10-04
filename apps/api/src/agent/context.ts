import { eq, desc } from "drizzle-orm";
import type { Content } from "@google/genai";
import { db, schema } from "../db";

export const SYSTEM_INSTRUCTION = `You are an AI coding agent building a small React + Vite web app inside a live project.

Rules:
- Make small, focused edits. Prefer edit_file over write_file when changing a file that already exists.
- Call read_file before edit_file if you have not already seen that file's current contents in this conversation.
- Keep the app using only React, Vite, and plain CSS unless the user explicitly asks for something else — call add_dependency before importing any new package.
- Call finish only once the app should actually work, with a short, friendly summary of what changed.
- index.html contains a script (type="module") that reports errors back to the editor. Never remove it, and never change it to a plain (non-module) script — it relies on import.meta.hot, which only works in a module script.`;

interface StoredMessageContent {
  text?: string;
}

/**
 * Loads recent chat turns as Gemini-formatted history. Only the final user
 * prompt and assistant summary of each past turn are persisted — the
 * tool-calling steps within a turn aren't stored, so history doesn't
 * include them either. Good enough for now; revisited if context size
 * becomes a problem on larger projects.
 */
export async function loadHistory(projectId: string, limit = 20): Promise<Content[]> {
  const rows = await db
    .select({ role: schema.messages.role, content: schema.messages.content })
    .from(schema.messages)
    .where(eq(schema.messages.projectId, projectId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);

  return rows
    .reverse()
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: (row.content as StoredMessageContent).text ?? "" }],
    }));
}