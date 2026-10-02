import { useEffect, useRef, useState } from "react";
import type { WebContainer } from "@webcontainer/api";
import { WebContainer as WebContainerClass } from "@webcontainer/api";
import { useApi, ApiError } from "./api";
import { filesToTree } from "./fileTree";

export type RuntimeStatus =
  | "idle"
  | "booting"
  | "installing"
  | "starting"
  | "ready"
  | "error";

// A tab can only have one booted WebContainer at a time. Keeping the
// promise at module scope (rather than in the hook/component) means React
// 18 StrictMode's dev-mode double-invoke of effects reuses the same
// instance instead of trying to boot a second one.
let containerPromise: Promise<WebContainer> | null = null;
function getContainer(): Promise<WebContainer> {
  // Must match the Cross-Origin-Embedder-Policy header value set in
  // vite.config.ts (server.headers / preview.headers) — the two are
  // negotiating the same cross-origin isolation mode from two ends.
  if (!containerPromise) {
    containerPromise = WebContainerClass.boot({ coep: "credentialless" });
  }
  return containerPromise;
}

function toAbsolute(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function ensureDir(container: WebContainer, filePath: string) {
  const dir = filePath.split("/").slice(0, -1).join("/");
  if (!dir) return;
  // The agent can create a file in a directory that doesn't exist in the
  // container yet (fs.writeFile won't create parent dirs on its own).
  await container.fs.mkdir(toAbsolute(dir), { recursive: true }).catch(() => { });
}

const SYNC_DEBOUNCE_MS = 1000;

export function useWebContainer(projectId: string) {
  const { request } = useApi();
  const [status, setStatus] = useState<RuntimeStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());

  const containerRef = useRef<WebContainer | null>(null);
  const snapshotIdRef = useRef<string | null>(null);
  const filesRef = useRef<Record<string, string>>({});
  const dirtyPathsRef = useRef<Set<string>>(new Set());
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function appendLog(chunk: string) {
      if (!cancelled) setLogs((prev) => [...prev.slice(-199), chunk]);
    }

    async function run() {
      setStatus("booting");
      const container = await getContainer();
      if (cancelled) return;
      containerRef.current = container;

      container.on("server-ready", (_port, url) => {
        if (!cancelled) {
          setPreviewUrl(url);
          setStatus("ready");
        }
      });

      const { snapshotId, files: initialFiles } = await request<{
        snapshotId: string | null;
        files: Record<string, string>;
      }>(`/api/projects/${projectId}/files`);
      if (cancelled) return;

      snapshotIdRef.current = snapshotId;
      filesRef.current = initialFiles;
      setFiles(initialFiles);

      await container.mount(filesToTree(initialFiles));

      setStatus("installing");
      const install = await container.spawn("npm", ["install"]);
      install.output.pipeTo(new WritableStream({ write: appendLog }));
      const installExit = await install.exit;
      if (cancelled) return;
      if (installExit !== 0) {
        setStatus("error");
        setError("npm install failed — check the logs");
        return;
      }

      setStatus("starting");
      const dev = await container.spawn("npm", ["run", "dev"]);
      dev.output.pipeTo(new WritableStream({ write: appendLog }));
      // Actual "ready" transition happens in the server-ready listener
      // above, once Vite reports which port it's listening on.
    }

    run().catch((err) => {
      if (!cancelled) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to start the runtime");
      }
    });

    return () => {
      cancelled = true;
      // Not tearing the container down here on purpose — see the comment
      // on containerPromise above.
    };
  }, [projectId, request]);

  function scheduleSync() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const baseSnapshotId = snapshotIdRef.current;
      if (!baseSnapshotId) return; // still loading initial files

      try {
        const { snapshotId } = await request<{ snapshotId: string }>(
          `/api/projects/${projectId}/files`,
          {
            method: "PUT",
            body: JSON.stringify({
              baseSnapshotId,
              files: filesRef.current,
            }),
          }
        );
        snapshotIdRef.current = snapshotId;
        // Whole-manifest sync succeeded, so everything typed before this
        // point is now reflected server-side — safe to apply live patches
        // to any of it again.
        dirtyPathsRef.current.clear();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setError("This project changed elsewhere — reload to see the latest.");
        } else {
          setError("Failed to save your changes");
        }
      }
    }, SYNC_DEBOUNCE_MS);
  }

  /** User-driven edit from the Monaco editor. */
  async function writeFile(path: string, content: string) {
    const container = containerRef.current;
    if (!container) return;

    dirtyPathsRef.current.add(path);

    await container.fs.writeFile(toAbsolute(path), content);
    filesRef.current = { ...filesRef.current, [path]: content };
    setFiles(filesRef.current);
    scheduleSync();
  }

  /**
   * Agent-driven change arriving over SSE. Unlike writeFile(), this does
   * NOT call scheduleSync() — the agent's change is already persisted
   * server-side as part of its own snapshot, so echoing it back with a PUT
   * would be redundant (and would race the snapshot id update below).
   */
  async function applyPatch(path: string, op: "write" | "delete", content?: string) {
    if (dirtyPathsRef.current.has(path)) {
      // The user has unsynced local edits to this exact file. Overwriting
      // it would silently destroy their in-progress typing; dropping the
      // agent's change silently would leave the project inconsistent.
      // Flag it instead and let a reload reconcile once it's safe.
      setConflicts((prev) => new Set(prev).add(path));
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (op === "delete") {
      await container.fs.rm(toAbsolute(path)).catch(() => { });
      const next = { ...filesRef.current };
      delete next[path];
      filesRef.current = next;
      setFiles(next);
    } else {
      await ensureDir(container, path);
      await container.fs.writeFile(toAbsolute(path), content ?? "");
      filesRef.current = { ...filesRef.current, [path]: content ?? "" };
      setFiles(filesRef.current);
    }
  }

  /**
   * Call once an agent turn's "done" event arrives. Without this, the
   * project's real head snapshot moves forward on the server every time
   * the agent finishes, but this tab's tracked id wouldn't — so the next
   * manual edit's optimistic-concurrency check would always 409.
   */
  function syncSnapshotId(id: string | null) {
    if (id) snapshotIdRef.current = id;
  }

  return {
    status,
    previewUrl,
    files,
    logs,
    error,
    conflicts,
    writeFile,
    applyPatch,
    syncSnapshotId,
  };
}