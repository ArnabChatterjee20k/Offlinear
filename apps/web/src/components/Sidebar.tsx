import { LayoutGrid, Inbox, Bot, LogOut, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeams } from "@/hooks/useData";
import { Avatar, Kbd } from "./ui/primitives";
import { useAuth } from "@/store/auth";
import { useUI } from "@/store/ui";
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
  const teams = useTeams();
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-hairline bg-canvas">
      <div className="flex h-12 items-center gap-2 border-b border-hairline px-4">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-[13px] font-bold text-white">
          O
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-ink">Offlinear</span>
      </div>

      <nav className="space-y-0.5 p-2">
        <NavItem icon={Inbox} label="Inbox" />
        <NavItem icon={LayoutGrid} label="Board" active />
        <NavItem icon={Bot} label="Agents" />
      </nav>

      <div className="mt-2 px-3 py-1 text-[11px] uppercase tracking-wider text-ink-tertiary">
        Teams
      </div>
      <nav className="space-y-0.5 px-2">
        {teams.map((t) => (
          <button
            key={t.id}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-subtle hover:bg-surface-1 hover:text-ink"
          >
            <span className="grid h-4 w-4 place-items-center rounded bg-surface-3 font-mono text-[9px] text-ink-subtle">
              {t.key}
            </span>
            {t.name}
          </button>
        ))}
      </nav>

      <div className="mt-auto p-2">
        <ShortcutsButton />
        <UserChip />
      </div>
    </aside>
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
  if (!name && !email) return null;
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <Avatar name={name ?? email} size={22} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-ink">{name ?? "Me"}</div>
        {email && <div className="truncate text-[11px] text-ink-tertiary">{email}</div>}
      </div>
      {appwriteConfigured && (
        <button
          title="Sign out"
          onClick={() => logout().then(() => window.location.reload())}
          className="rounded p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
