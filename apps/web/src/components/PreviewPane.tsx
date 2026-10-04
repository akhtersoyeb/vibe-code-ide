import { useEffect, useRef } from "react";

interface PreviewPaneProps {
  url: string | null;
  status: string;
  onRuntimeError?: (message: string) => void;
}

export function PreviewPane({ url, status, onRuntimeError }: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onRuntimeError) return;

    function handleMessage(event: MessageEvent) {
      // The preview iframe is cross-origin (a webcontainer-api.io
      // subdomain), so this is the only way errors from inside it reach us
      // — it has to postMessage itself (see the script injected into
      // index.html in templates.ts). Checking event.source against our own
      // iframe's contentWindow rejects messages from anywhere else on the
      // page, though it's not a full cross-origin security boundary.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.source !== "preview-error-reporter") return;
      if (onRuntimeError && typeof event.data.message === "string") {
        onRuntimeError(event.data.message);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onRuntimeError]);

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {status === "error" ? "Failed to start preview" : "Starting preview…"}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b bg-gray-50 px-2 py-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          Open in new tab
        </a>
      </div>
      <iframe
        ref={iframeRef}
        title="Preview"
        src={url}
        className="h-full w-full flex-1 border-0"
        // Same-origin isn't needed (and isn't available) since the preview is
        // served from a webcontainer-api.io subdomain, not our own origin.
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
      />
      {/* Some browsers (Firefox, Brave, Safari) block the Service Worker
          WebContainers needs inside a third-party iframe even when cookies
          are otherwise allowed. Opening the same URL as a top-level
          navigation sidesteps that entirely, since it's then first-party. */}
    </div>
  );
}