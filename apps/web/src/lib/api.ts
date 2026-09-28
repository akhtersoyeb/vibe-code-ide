import { useAuth } from "@clerk/clerk-react";
import { validateWebEnv } from "@vibe-code-ide/shared"

const env = validateWebEnv(import.meta.env);

/**
 * Must be used as a hook (not a plain module function) since getToken()
 * comes from Clerk's useAuth() and needs to run inside a component.
 *
 *   const { request } = useApi();
 *   const me = await request("/api/me");
 */
export function useApi() {
  const { getToken } = useAuth();

  async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();

    const res = await fetch(`${env.VITE_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  return { request };
}