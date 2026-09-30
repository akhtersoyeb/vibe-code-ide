import type { FileSystemTree } from "@webcontainer/api";

/** Converts a flat { "src/App.jsx": "content" } map into WebContainer's
 * nested FileSystemTree shape required by container.mount(). */
export function filesToTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let cursor: FileSystemTree = tree;

    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      if (isFile) {
        cursor[part] = { file: { contents } };
        return;
      }
      const existing = cursor[part];
      if (!existing || !("directory" in existing)) {
        cursor[part] = { directory: {} };
      }
      cursor = (cursor[part] as { directory: FileSystemTree }).directory;
    });
  }

  return tree;
}

export interface FileTreeNode {
  name: string;
  path: string;
  children?: FileTreeNode[];
}

/** Builds a nested { name, path, children? } tree for the sidebar UI from
 * the same flat path list. */
export function filesToNodes(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const path of Object.keys(files).sort()) {
    const parts = path.split("/").filter(Boolean);
    let cursor = root;
    let currentPath = "";

    parts.forEach((part, i) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = cursor.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: currentPath };
        cursor.push(node);
      }
      if (i < parts.length - 1) {
        node.children ??= [];
        cursor = node.children;
      }
    });
  }

  return root;
}