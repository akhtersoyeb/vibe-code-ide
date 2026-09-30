import Editor from "@monaco-editor/react";

function languageFor(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
}

interface EditorPaneProps {
  path: string | null;
  content: string;
  onChange: (content: string) => void;
}

export function EditorPane({ path, content, onChange }: EditorPaneProps) {
  if (!path) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Select a file to edit
      </div>
    );
  }

  return (
    <Editor
      // Remounts Monaco on file switch, so it doesn't need to diff values
      // across unrelated files itself.
      key={path}
      height="100%"
      language={languageFor(path)}
      value={content}
      onChange={(value) => onChange(value ?? "")}
      options={{ minimap: { enabled: false }, fontSize: 13 }}
    />
  );
}