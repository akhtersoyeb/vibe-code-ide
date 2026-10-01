import type { FunctionDeclaration } from "@google/genai";

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "list_files",
    description: "List every file path currently in the project.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "read_file",
    description: "Read the full current contents of one file.",
    parametersJsonSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create a new file, or fully replace an existing file's contents.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace one exact occurrence of `old` with `new` in an existing file. `old` must match the file's current contents exactly and uniquely. If it doesn't match, read_file again and retry with corrected text — don't guess.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old: { type: "string" },
        new: { type: "string" },
      },
      required: ["path", "old", "new"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the project.",
    parametersJsonSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "add_dependency",
    description: "Add an npm package to package.json's dependencies.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "finish",
    description:
      "Call this once you are done making changes and the app should work. Give a short, friendly, user-facing summary of what changed — one or two sentences.",
    parametersJsonSchema: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
];

export interface ToolContext {
  files: Record<string, string>;
  onPatch: (path: string, op: "write" | "delete", content?: string) => void;
}

function assertSafePath(path: string) {
  if (typeof path !== "string" || path.startsWith("/") || path.includes("..")) {
    throw new Error(`Unsafe or invalid path: ${path}`);
  }
}

export function runTool(
  name: string,
  args: Record<string, any>,
  ctx: ToolContext
): Record<string, unknown> {
  switch (name) {
    case "list_files":
      return { paths: Object.keys(ctx.files).sort() };

    case "read_file": {
      assertSafePath(args.path);
      const content = ctx.files[args.path];
      if (content === undefined) return { error: `File not found: ${args.path}` };
      return { content };
    }

    case "write_file": {
      assertSafePath(args.path);
      ctx.files[args.path] = args.content ?? "";
      ctx.onPatch(args.path, "write", ctx.files[args.path]);
      return { ok: true };
    }

    case "edit_file": {
      assertSafePath(args.path);
      const current = ctx.files[args.path];
      if (current === undefined) {
        return { error: `File not found: ${args.path}. Use write_file to create it.` };
      }
      const occurrences = current.split(args.old).length - 1;
      if (occurrences === 0) {
        return {
          error:
            "`old` was not found in the file's current contents — read_file again and retry with the exact text.",
        };
      }
      if (occurrences > 1) {
        return {
          error:
            "`old` matches more than once — include more surrounding context so it matches exactly one place.",
        };
      }
      const updated = current.replace(args.old, args.new ?? "");
      ctx.files[args.path] = updated;
      ctx.onPatch(args.path, "write", updated);
      return { ok: true };
    }

    case "delete_file": {
      assertSafePath(args.path);
      if (!(args.path in ctx.files)) return { error: `File not found: ${args.path}` };
      delete ctx.files[args.path];
      ctx.onPatch(args.path, "delete");
      return { ok: true };
    }

    case "add_dependency": {
      const pkgPath = "package.json";
      const pkg = JSON.parse(ctx.files[pkgPath] ?? "{}");
      pkg.dependencies ??= {};
      pkg.dependencies[args.name] = args.version ?? "latest";
      const updated = JSON.stringify(pkg, null, 2) + "\n";
      ctx.files[pkgPath] = updated;
      ctx.onPatch(pkgPath, "write", updated);
      return { ok: true };
    }

    case "finish":
      return { ok: true };

    default:
      return { error: `Unknown tool: ${name}` };
  }
}