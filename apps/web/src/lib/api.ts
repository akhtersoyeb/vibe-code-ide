import { useAuth } from "@clerk/clerk-react";
import { validateWebEnv } from "@vibe-code-ide/shared"
import { useCallback, useEffect, useRef } from "react";

const env = validateWebEnv(import.meta.env);
const API_URL = env.VITE_API_BASE_URL

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Must be used as a hook (not a plain module function) since getToken()
 * comes from Clerk's useAuth() and needs to run inside a component.
 *
 *   const { request } = useApi();
 *   const projects = await request<Project[]>("/api/projects");
 *
 * `request` keeps the same identity across renders, so it's safe to list in
 * useEffect / useCallback dependency arrays without causing refetch loops.
 */
export function useApi() {
  const { getToken } = useAuth();

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const request = useCallback(async function <T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getTokenRef.current();

    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // Only claim a JSON body when there is one. Fastify rejects requests
    // (e.g. DELETE) that send Content-Type: application/json with no body.
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, `API error ${res.status}: ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }, []);

  return { request };
}
