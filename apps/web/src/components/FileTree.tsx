import type { FileTreeNode } from "../lib/fileTree";

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
  return (
    <ul className="text-sm">
      {nodes.map((node) => (
        <FileTreeItem key={node.path} node={node} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function FileTreeItem({
  node,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  if (node.children) {
    return (
      <li>
        <div className="px-2 py-1 text-xs font-medium uppercase text-gray-400">
          {node.name}
        </div>
        <ul className="ml-2 border-l border-gray-200 pl-2">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={() => onSelect(node.path)}
        className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100 ${selectedPath === node.path ? "bg-gray-200 font-medium" : ""
          }`}
      >
        {node.name}
      </button>
    </li>
  );
}