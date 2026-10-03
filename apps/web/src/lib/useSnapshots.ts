import { useCallback, useEffect, useState } from "react";
import { useApi } from "./api";

export interface Snapshot {
  id: string;
  parentId: string | null;
  createdBy: "ai" | "user" | "system";
  createdAt: string;
}

export function useSnapshots(projectId: string) {
  const { request } = useApi();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<Snapshot[]>(`/api/projects/${projectId}/snapshots`);
      setSnapshots(data);
    } finally {
      setLoading(false);
    }
  }, [projectId, request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Reverts on the server and returns the new snapshot's id. Does not
   * touch the live runtime — the caller is responsible for pulling the
   * reverted files into the running WebContainer afterward. */
  const revertTo = useCallback(
    async (snapshotId: string) => {
      const result = await request<{ snapshotId: string }>(
        `/api/projects/${projectId}/revert`,
        {
          method: "POST",
          body: JSON.stringify({ snapshotId }),
        }
      );
      await refresh();
      return result.snapshotId;
    },
    [projectId, request, refresh]
  );

  return { snapshots, loading, revertTo };
}