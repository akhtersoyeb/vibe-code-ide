import { createHash } from "node:crypto";
import { slugify } from "../lib/slugify";

const VERCEL_API = "https://api.vercel.com";

function vercelHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not set");
  return { Authorization: `Bearer ${token}`, ...extra };
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

interface UploadedFile {
  file: string;
  sha: string;
  size: number;
}

async function uploadFile(path: string, content: string): Promise<UploadedFile> {
  const buffer = Buffer.from(content, "utf8");
  const sha = createHash("sha1").update(buffer).digest("hex");

  const res = await fetch(`${VERCEL_API}/v2/files${teamQuery()}`, {
    method: "POST",
    headers: vercelHeaders({
      "x-vercel-digest": sha,
      "Content-Length": String(buffer.byteLength),
      "Content-Type": "application/octet-stream",
    }),
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel file upload failed for ${path}: ${res.status} ${text}`);
  }

  return { file: path, sha, size: buffer.byteLength };
}

/**
 * Uploads every file and creates a production deployment from them.
 * Source files (not a pre-built dist/) go up, and projectSettings.framework
 * tells Vercel to run the actual Vite build itself — necessary since the
 * agent's add_dependency tool means package.json can't be assumed fixed.
 *
 * Returns as soon as Vercel accepts the deployment, not once the build
 * finishes — the URL becomes live within roughly a minute. No polling for
 * build completion in this version.
 */
export async function deployToVercel(
  projectName: string,
  files: Record<string, string>
): Promise<string> {
  const uploaded = await Promise.all(
    Object.entries(files).map(([path, content]) => uploadFile(path, content))
  );

  const res = await fetch(`${VERCEL_API}/v13/deployments${teamQuery()}`, {
    method: "POST",
    headers: vercelHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: slugify(projectName),
      files: uploaded,
      target: "production",
      projectSettings: { framework: "vite" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel deployment failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { url: string };
  return `https://${data.url}`;
}