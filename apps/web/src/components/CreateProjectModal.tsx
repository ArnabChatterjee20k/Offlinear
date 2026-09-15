import * as React from "react";
import { Github, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useUI } from "@/store/ui";
import { createProject } from "@/store/mutations";

export function CreateProjectModal() {
  const open = useUI((s) => s.createProjectOpen);
  const setCreateProject = useUI((s) => s.setCreateProject);
  const setCurrentProject = useUI((s) => s.setCurrentProject);
  const setGithub = useUI((s) => s.setGithub);

  const [name, setName] = React.useState("");
  const [step, setStep] = React.useState<"name" | "connect">("name");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setStep("name");
    }
  }, [open]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await createProject({ name: name.trim() });
      setCurrentProject(id);
      setStep("connect");
    } finally {
      setBusy(false);
    }
  };

  const finish = (connect: boolean) => {
    setCreateProject(false);
    if (connect) setGithub(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setCreateProject(false)}>
      <DialogContent aria-describedby={undefined} className="max-w-[460px] p-0">
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
          <LayoutGrid className="h-4 w-4 text-ink" />
          <DialogTitle className="text-[15px] font-medium text-ink">
            {step === "name" ? "New project" : "Connect GitHub?"}
          </DialogTitle>
        </div>

        <div className="p-5">
          {step === "name" ? (
            <div className="space-y-3">
              <Input
                autoFocus
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
              />
              <div className="flex justify-end">
                <Button variant="primary" disabled={busy || !name.trim()} onClick={create}>
                  Create project
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[14px] text-ink-muted">
                Link this project to a GitHub Projects v2 board to import/export and auto-sync
                issues — or start working and connect later.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => finish(false)}>
                  Continue without GitHub
                </Button>
                <Button variant="primary" onClick={() => finish(true)}>
                  <Github className="h-4 w-4" /> Connect GitHub
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
