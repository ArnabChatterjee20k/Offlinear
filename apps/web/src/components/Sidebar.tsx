import { LayoutGrid, Bot, LogOut, Keyboard, FileText, Trash2, Plus, Github } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects, useDrafts } from "@/hooks/useData";
import { Avatar, Kbd } from "./ui/primitives";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";
import { deleteDraft } from "@/store/drafts";
import { logout } from "@/auth";
import { appwriteConfigured } from "@/sync/appwrite-config";

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof LayoutGrid;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        active ? "bg-surface-2 text-ink" : "text-ink-subtle hover:bg-surface-1 hover:text-ink"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-hairline bg-canvas">
      <div className="flex h-12 items-center gap-2 border-b border-hairline px-4">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-[13px] font-bold text-white">
          O
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-ink">Offlinear</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <nav className="space-y-0.5">
          <NavItem icon={Bot} label="Agents" />
        </nav>
        <Projects />
        <Drafts />
      </div>

      <div className="p-2">
        <ShortcutsButton />
        <UserChip />
      </div>
    </aside>
  );
}

function Projects() {
  const projects = useProjects();
  const currentId = useUI((s) => s.currentProjectId);
  const setCurrentProject = useUI((s) => s.setCurrentProject);
  const setCreateProject = useUI((s) => s.setCreateProject);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] uppercase tracking-wider text-ink-tertiary">Projects</span>
        <button
          onClick={() => setCreateProject(true)}
          title="New project"
          className="rounded p-0.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <nav className="space-y-0.5">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setCurrentProject(p.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
              p.id === currentId
                ? "bg-surface-2 text-ink"
                : "text-ink-subtle hover:bg-surface-1 hover:text-ink"
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="truncate">{p.name}</span>
            {p.githubProjectId && <Github className="ml-auto h-3 w-3 shrink-0 text-ink-tertiary" />}
          </button>
        ))}
        {projects.length === 0 && (
          <button
            onClick={() => setCreateProject(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-subtle hover:bg-surface-1 hover:text-ink"
          >
            <Plus className="h-4 w-4" /> New project
          </button>
        )}
      </nav>
    </div>
  );
}

function Drafts() {
  const drafts = useDrafts();
  const openCreate = useUI((s) => s.openCreate);
  if (drafts.length === 0) return null;
  return (
    <div className="px-2 pt-2">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] uppercase tracking-wider text-ink-tertiary">
        <FileText className="h-3 w-3" />
        Drafts
        <span className="text-ink-tertiary">{drafts.length}</span>
      </div>
      <div className="space-y-0.5">
        {drafts.map((d) => (
          <div
            key={d.id}
            className="group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-surface-1"
          >
            <button
              onClick={() => openCreate({ draftId: d.id })}
              className="min-w-0 flex-1 truncate text-left text-[13px] text-ink-muted hover:text-ink"
            >
              {d.title || "Untitled"}
            </button>
            <button
              onClick={() => deleteDraft(d.id)}
              className="rounded p-0.5 text-ink-tertiary opacity-0 hover:text-danger group-hover:opacity-100"
              title="Discard draft"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutsButton() {
  const setHelp = useUI((s) => s.setHelp);
  return (
    <button
      onClick={() => setHelp(true)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-subtle hover:bg-surface-1 hover:text-ink"
    >
      <Keyboard className="h-4 w-4" />
      Shortcuts
      <Kbd>?</Kbd>
    </button>
  );
}

function UserChip() {
  const { name, email } = useAuth();
  const signOut = () => logout().then(() => window.location.reload());
  return (
    <div className="space-y-0.5">
      {(name || email) && (
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Avatar name={name ?? email} size={22} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-ink">{name ?? "Me"}</div>
            {email && <div className="truncate text-[11px] text-ink-tertiary">{email}</div>}
          </div>
        </div>
      )}
      {appwriteConfigured && (
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-subtle hover:bg-surface-1 hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      )}
    </div>
  );
}
