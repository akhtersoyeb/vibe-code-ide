import { useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { validateWebEnv } from "@vibe-code-ide/shared"

const env = validateWebEnv(import.meta.env);
const API_URL = env.VITE_API_BASE_URL

/**
 * Separate from useApi() because the response here is a binary zip, not
 * JSON — same reasoning as useChatStream bypassing it for SSE.
 */
export function useExport(projectId: string) {
  const { getToken } = useAuth();

  const downloadExport = useCallback(
    async (filename: string) => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/projects/${projectId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [projectId, getToken]
  );

  return { downloadExport };
}