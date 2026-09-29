import { useCallback, useEffect, useState } from "react";
import { useApi, ApiError } from "./api";

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  template: string;
  headSnapshotId: string | null;
  deployedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateProjectInput {
  name: string;
  template?: string;
}

export function useProjects() {
  const { request } = useApi();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<Project[]>("/api/projects");
      setProjects(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateProjectInput) => {
      const project = await request<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setProjects((prev) => [project, ...prev]);
      return project;
    },
    [request]
  );

  const remove = useCallback(
    async (id: string) => {
      await request(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [request]
  );

  return { projects, loading, error, create, remove, refresh };
}