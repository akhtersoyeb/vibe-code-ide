import { useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";
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
  if (!containerPromise) containerPromise = WebContainer.boot();
  return containerPromise;
}

function toAbsolute(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

const SYNC_DEBOUNCE_MS = 1000;

export function useWebContainer(projectId: string) {
  const { request } = useApi();
  const [status, setStatus] = useState<RuntimeStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<WebContainer | null>(null);
  const snapshotIdRef = useRef<string | null>(null);
  const filesRef = useRef<Record<string, string>>({});
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
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // Something else (another tab, later: the AI agent) moved the
          // project's head snapshot forward. Real merge handling lands
          // with Phase 9/10 — for now, surface it and stop auto-syncing
          // until the user reloads.
          setError("This project changed elsewhere — reload to see the latest.");
        } else {
          setError("Failed to save your changes");
        }
      }
    }, SYNC_DEBOUNCE_MS);
  }

  async function writeFile(path: string, content: string) {
    const container = containerRef.current;
    if (!container) return;

    await container.fs.writeFile(toAbsolute(path), content);
    filesRef.current = { ...filesRef.current, [path]: content };
    setFiles(filesRef.current);
    scheduleSync();
  }

  return { status, previewUrl, files, logs, error, writeFile };
}