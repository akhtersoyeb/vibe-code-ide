import { useState } from "react";
import { useSnapshots } from "../lib/useSnapshots";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CREATED_BY_LABEL: Record<string, string> = {
  ai: "AI",
  user: "You",
  system: "Initial",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface HistoryPanelProps {
  projectId: string;
  currentSnapshotId: string | null;
  onReverted: () => Promise<void>;
}

export function HistoryPanel({ projectId, currentSnapshotId, onReverted }: HistoryPanelProps) {
  const { snapshots, loading, revertTo } = useSnapshots(projectId);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  async function handleRevert(id: string) {
    setRevertingId(id);
    try {
      await revertTo(id);
      await onReverted();
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm">
        History
      </Button>} />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="p-2 text-sm text-gray-500">Loading…</p>}
          {!loading && snapshots.length === 0 && (
            <p className="p-2 text-sm text-gray-500">No history yet.</p>
          )}
          {snapshots.map((snap) => {
            const isCurrent = snap.id === currentSnapshotId;
            return (
              <div
                key={snap.id}
                className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium">
                    {CREATED_BY_LABEL[snap.createdBy] ?? snap.createdBy}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">{formatTime(snap.createdAt)}</span>
                  {isCurrent && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      current
                    </span>
                  )}
                </div>
                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revertingId !== null}
                    onClick={() => handleRevert(snap.id)}
                  >
                    {revertingId === snap.id ? "Reverting…" : "Revert"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}