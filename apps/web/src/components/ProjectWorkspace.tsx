import { useEffect, useMemo, useState } from "react";
import { useWebContainer } from "../lib/useWebContainer";
import { filesToNodes } from "../lib/fileTree";
import { FileTree } from "./FileTree";
import { EditorPane } from "./EditorPane";
import { PreviewPane } from "./PreviewPane";
import { ChatPanel } from "./ChatPanel";

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
}: {
  projectId: string;
  projectName: string;
}) {
  const { status, previewUrl, files, error, writeFile } = useWebContainer(projectId);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const nodes = useMemo(() => filesToNodes(files), [files]);

  // Once files load, default to opening the main app file rather than
  // leaving the editor blank.
  useEffect(() => {
    if (selectedPath || Object.keys(files).length === 0) return;
    const preferred = Object.keys(files).find((p) => p.endsWith("App.jsx"));
    setSelectedPath(preferred ?? Object.keys(files)[0]);
  }, [files, selectedPath]);

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <span className="text-sm font-medium">{projectName}</span>
        <span className={`text-xs ${status === "error" ? "text-red-600" : "text-gray-500"}`}>
          {error ?? STATUS_LABEL[status]}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-[200px_1fr_1fr_320px] overflow-hidden">
        <div className="overflow-y-auto border-r bg-gray-50 p-2">
          <FileTree nodes={nodes} selectedPath={selectedPath} onSelect={setSelectedPath} />
        </div>

        <div className="overflow-hidden border-r">
          <EditorPane
            path={selectedPath}
            content={selectedPath ? files[selectedPath] ?? "" : ""}
            onChange={(content) => selectedPath && writeFile(selectedPath, content)}
          />
        </div>

        <div className="overflow-hidden border-r">
          <PreviewPane url={previewUrl} status={status} />
        </div>

        <div className="overflow-hidden">
          <ChatPanel projectId={projectId} />
        </div>
      </div>
    </div>
  );
}