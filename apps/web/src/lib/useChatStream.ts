import { useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface SseEvent {
  event: string;
  data: unknown;
}

/**
 * Posts to a project's chat endpoint and parses the Server-Sent Events
 * response by hand. The browser's built-in EventSource can't be used here —
 * it only supports GET requests with no custom headers, and this needs a
 * POST carrying an Authorization bearer token.
 */
export function useChatStream(projectId: string) {
  const { getToken } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (onEvent: (e: SseEvent) => void) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const token = await getToken();
      const res = await fetch(`${API_URL}/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by a blank line.
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const lines = raw.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));

          if (eventLine && dataLine) {
            onEvent({
              event: eventLine.slice("event:".length).trim(),
              data: JSON.parse(dataLine.slice("data:".length).trim()),
            });
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
    },
    [projectId, getToken]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, stop };
}