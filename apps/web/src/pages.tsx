import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useProjects, type Project } from "./lib/useProjects";
import { useApi, ApiError } from "./lib/api";
import { NewProjectModal } from "./components/NewProjectModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Landing() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-4xl font-bold">Build web apps by chatting with AI</h1>
      <p className="mt-4 text-gray-600">
        Describe what you want and watch it appear, live, in the browser.
      </p>
    </div>
  );
}

export function SignInPage() {
  return (
    <div className="flex justify-center py-16">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex justify-center py-16">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}

export function Dashboard() {
  const { projects, loading, error, create, remove } = useProjects();
  const navigate = useNavigate();

  async function handleCreate({
    name,
    template,
    prompt,
  }: {
    name: string;
    template: string;
    prompt?: string;
  }) {
    const project = await create({ name, template });
    if (prompt) {
      // Picked up in Phase 9 once the chat/agent loop exists.
      sessionStorage.setItem(`project:${project.id}:starting-prompt`, prompt);
    }
    navigate(`/project/${project.id}`);
  }

  async function handleDelete(id: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project? This can't be undone.")) return;
    await remove(id);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your projects</h1>
        <NewProjectModal onCreate={handleCreate} />
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <p className="text-gray-500">No projects yet — create your first one above.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="cursor-pointer transition hover:border-gray-400"
            onClick={() => navigate(`/project/${project.id}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{project.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={(e) => handleDelete(project.id, e)}>
                Delete
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">{project.template}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { request } = useApi();
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    setStatus("loading");
    request<Project>(`/api/projects/${id}`)
      .then((data) => {
        setProject(data);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
      });
  }, [id, request]);

  if (status === "loading") {
    return <div className="p-12 text-center text-gray-500">Loading…</div>;
  }
  if (status === "not-found") {
    return <div className="p-12 text-center text-gray-500">Project not found.</div>;
  }
  if (status === "error") {
    return <div className="p-12 text-center text-red-600">Couldn't load this project.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">{project!.name}</h1>
      <p className="mt-2 text-sm text-gray-500">Template: {project!.template}</p>
      {/* Phase 7 replaces this with the editor + live preview workspace. */}
    </div>
  );
}