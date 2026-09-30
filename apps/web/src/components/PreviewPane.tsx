interface PreviewPaneProps {
  url: string | null;
  status: string;
}

export function PreviewPane({ url, status }: PreviewPaneProps) {
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        {status === "error" ? "Failed to start preview" : "Starting preview…"}
      </div>
    );
  }

  return (
    <iframe
      title="Preview"
      src={url}
      className="h-full w-full border-0"
      // Same-origin isn't needed (and isn't available) since the preview is
      // served from a webcontainer-api.io subdomain, not our own origin.
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
    />
  );
}