import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewProjectInput {
  name: string;
  template: string;
  prompt?: string;
}

interface NewProjectModalProps {
  onCreate: (input: NewProjectInput) => Promise<void>;
}

export function NewProjectModal({ onCreate }: NewProjectModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("vite-react");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your project a name");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // The backend only stores name + template as of Phase 5 — `prompt` is
      // carried up to the caller so it can be stashed for Phase 9's agent
      // loop to consume as the first chat turn.
      await onCreate({ name: name.trim(), template, prompt: prompt.trim() || undefined });
      setOpen(false);
      setName("");
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New project</Button>} />
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My pricing page"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-template">Template</Label>
              <Select value={template} onValueChange={value => setTemplate(value || "vite-react")}>
                <SelectTrigger id="project-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vite-react">React + Vite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-prompt">Starting prompt (optional)</Label>
              <Textarea
                id="project-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A landing page for a coffee subscription…"
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}