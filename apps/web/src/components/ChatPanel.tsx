import {
  forwardRef,
  useImperativeHandle,
  useState,
  type KeyboardEvent,
} from "react";
import { useChatStream } from "../lib/useChatStream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  projectId: string;
  onFilePatch: (path: string, op: "write" | "delete", content?: string) => void;
  onDone: (snapshotId: string | null) => void;
}

export interface ChatPanelHandle {
  /** Starts an auto-fix turn against /chat/fix. Exposed via ref since the
   * error banners that trigger this live in PreviewPane / ProjectWorkspace,
   * outside this component — but the fix itself still shows up in the
   * transcript like any other turn, rather than happening invisibly. */
  triggerFix: (error: string) => void;
}

export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(
  { projectId, onFilePatch, onDone },
  ref
) {
  const { send, sendFix } = useChatStream(projectId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  function handleEvent(event: string, data: unknown) {
    if (event === "text_delta") {
      const { text: chunk } = data as { text: string };
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + chunk };
        return next;
      });
    } else if (event === "file_patch") {
      const { path, op, content } = data as {
        path: string;
        op: "write" | "delete";
        content?: string;
      };
      onFilePatch(path, op, content);
    } else if (event === "done") {
      const { snapshotId } = data as { snapshotId: string | null };
      onDone(snapshotId);
    } else if (event === "error") {
      const { message } = data as { message: string };
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${message}` };
        return next;
      });
    }
  }

  /** Shared by both a normal send and an auto-fix trigger — both are just
   * "a user-facing label, plus a stream of events to react to". */
  async function runTurn(
    userLabel: string,
    stream: (onEvent: (e: { event: string; data: unknown }) => void) => Promise<void>
  ) {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userLabel },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);
    try {
      await stream((e) => handleEvent(e.event, e.data));
    } catch (err) {
      // Pre-stream rejections (rate limit, out of credits, project already
      // running) throw here with a specific message rather than arriving
      // as an "error" SSE event — surface it the same way either way.
      const content = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await runTurn(text, (onEvent) => send(text, onEvent));
  }

  useImperativeHandle(
    ref,
    () => ({
      triggerFix(error: string) {
        if (streaming) return;
        runTurn("🔧 Fix the error in the running app", (onEvent) => sendFix(error, onEvent));
      },
    }),
    [streaming, sendFix]
  );

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">Ask for a change to get started.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-gray-100" : "bg-blue-50"
              }`}
          >
            {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t p-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for a change…"
          rows={2}
          disabled={streaming}
        />
        <Button onClick={handleSend} disabled={streaming || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
});