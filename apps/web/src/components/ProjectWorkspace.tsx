import { useEffect, useMemo, useRef, useState } from "react";
import { useWebContainer } from "../lib/useWebContainer";
import { useApi, ApiError } from "../lib/api";
import { useExport } from "../lib/useExport";
import { filesToNodes } from "../lib/fileTree";
import { FileTree } from "./FileTree";
import { EditorPane } from "./EditorPane";
import { PreviewPane } from "./PreviewPane";
import { ChatPanel, type ChatPanelHandle } from "./ChatPanel";
import { HistoryPanel } from "./HistoryPanel";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  idle: "Starting…",
  booting: "Booting runtime…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  ready: "Running",
  error: "Error",
};

export function ProjectWorkspace({
  projectId,
  projectName,
  initialDeployedUrl,
}: {
  projectId: string;
  projectName: string;
  initialDeployedUrl?: string | null;
}) {
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(initialDeployedUrl ?? null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { request } = useApi();
  const { downloadExport } = useExport(projectId);

  const {
    status,
    previewUrl,
    files,
    error,
    conflicts,
    currentSnapshotId,
    writeFile,
    applyPatch,
    syncSnapshotId,
    reloadFiles,
  } = useWebContainer(projectId, { onBuildError: setPendingError });

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const chatRef = useRef<ChatPanelHandle>(null);

  const nodes = useMemo(() => filesToNodes(files), [files]);

  // Once files load, default to opening the main app file rather than
  // leaving the editor blank.
  useEffect(() => {
    if (selectedPath || Object.keys(files).length === 0) return;
    const preferred = Object.keys(files).find((p) => p.endsWith("App.jsx"));
    setSelectedPath(preferred ?? Object.keys(files)[0]);
  }, [files, selectedPath]);

  const selectedHasConflict = selectedPath !== null && conflicts.has(selectedPath);

  function handleFix() {
    if (!pendingError) return;
    chatRef.current?.triggerFix(pendingError);
    setPendingError(null);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExport(projectName);
    } catch {
      // Export failing isn't disruptive enough to warrant a banner — the
      // user can just try again.
    } finally {
      setExporting(false);
    }
  }

  async function handleDeploy() {
    setDeploying(true);
    setDeployError(null);
    try {
      const result = await request<{ deployedUrl: string }>(
        `/api/projects/${projectId}/deploy`,
        { method: "POST" }
      );
      setDeployedUrl(result.deployedUrl);
    } catch (err) {
      setDeployError(err instanceof ApiError ? err.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <span className="text-sm font-medium">{projectName}</span>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${status === "error" ? "text-red-600" : "text-gray-500"}`}>
            {error ?? STATUS_LABEL[status]}
          </span>
          <HistoryPanel
            projectId={projectId}
            currentSnapshotId={currentSnapshotId}
            onReverted={reloadFiles}
          />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export"}
          </Button>
          {deployedUrl && (
            <a
              href={deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline"
            >
              {deployedUrl.replace(/^https?:\/\//, "")}
            </a>
          )}
          <Button size="sm" onClick={handleDeploy} disabled={deploying}>
            {deploying ? "Deploying…" : deployedUrl ? "Redeploy" : "Deploy"}
          </Button>
        </div>
      </div>
      {deployError && (
        <div className="bg-red-50 px-4 py-1 text-xs text-red-700">{deployError}</div>
      )}

      <div className="grid flex-1 grid-cols-[200px_1fr_1fr_320px] overflow-hidden">
        <div className="overflow-y-auto border-r bg-gray-50 p-2">
          <FileTree nodes={nodes} selectedPath={selectedPath} onSelect={setSelectedPath} />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden border-r">
          {selectedHasConflict && (
            <div className="flex items-center justify-between bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              <span>The AI changed this file while you were editing it.</span>
              <button
                onClick={() => window.location.reload()}
                className="font-medium underline"
              >
                Reload to see its version
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <EditorPane
              path={selectedPath}
              content={selectedPath ? files[selectedPath] ?? "" : ""}
              onChange={(content) => selectedPath && writeFile(selectedPath, content)}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden border-r">
          {pendingError && (
            <div className="flex items-center justify-between bg-red-50 px-3 py-1.5 text-xs text-red-800">
              <span className="truncate pr-2">{pendingError}</span>
              <button onClick={handleFix} className="shrink-0 font-medium underline">
                Fix with AI
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <PreviewPane url={previewUrl} status={status} onRuntimeError={setPendingError} />
          </div>
        </div>

        <div className="overflow-hidden">
          <ChatPanel
            ref={chatRef}
            projectId={projectId}
            onFilePatch={applyPatch}
            onDone={(id) => {
              syncSnapshotId(id);
              // The app just got rebuilt from this turn — any error shown
              // before it is presumably stale now, whether this was a
              // normal turn or a fix. A new one will surface again if it's
              // still actually broken.
              setPendingError(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}