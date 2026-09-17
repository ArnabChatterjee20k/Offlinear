import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Kbd } from "./ui/primitives";
import { useUI } from "@/store/ui";
import { BACKSPACE, ENTER, MOD, SHIFT } from "@/lib/platform";

interface Shortcut {
  keys: string[];
  label: string;
}
interface Group {
  title: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["↑", "↓"], label: "Move focus between issues" },
      { keys: ["J", "K"], label: "Move focus (vim keys)" },
      { keys: [ENTER], label: "Open focused issue" },
      { keys: ["Esc"], label: "Close panel / clear selection" },
    ],
  },
  {
    title: "General",
    items: [
      { keys: [MOD, "K"], label: "Command palette" },
      { keys: ["C"], label: "Create issue" },
      { keys: ["?"], label: "This shortcut sheet" },
    ],
  },
  {
    title: "Selection & edits",
    items: [
      { keys: ["X"], label: "Select / deselect issue" },
      { keys: ["⇧ Click"], label: "Select a range" },
      { keys: [`${MOD} Click`], label: "Toggle one" },
      { keys: [MOD, "A"], label: "Select all" },
      { keys: [BACKSPACE], label: "Delete selected" },
      { keys: [MOD, "Z"], label: "Undo" },
      { keys: [MOD, SHIFT, "Z"], label: "Redo" },
    ],
  },
  {
    title: "Issue actions",
    items: [
      { keys: ["S"], label: "Change status" },
      { keys: ["P"], label: "Set priority" },
      { keys: ["A"], label: "Assign" },
      { keys: ["L"], label: "Toggle labels" },
    ],
  },
  {
    title: "Comments",
    items: [{ keys: [MOD, ENTER], label: "Submit comment" }],
  },
  {
    title: "Editor (type to format)",
    items: [
      { keys: ["# "], label: "Heading" },
      { keys: ["- "], label: "Bullet list" },
      { keys: ["1. "], label: "Numbered list" },
      { keys: ["> "], label: "Quote" },
      { keys: ["```"], label: "Code block" },
      { keys: ["**b**"], label: "Bold" },
      { keys: ["*i*"], label: "Italic" },
    ],
  },
];

export function ShortcutsHelp() {
  const helpOpen = useUI((s) => s.helpOpen);
  const setHelp = useUI((s) => s.setHelp);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelp}>
      <DialogContent aria-describedby={undefined} className="max-w-[600px] p-0">
        <div className="border-b border-hairline px-5 py-3.5">
          <DialogTitle className="text-[15px] font-medium text-ink">
            Keyboard shortcuts
          </DialogTitle>
        </div>
        <div className="grid max-h-[70vh] grid-cols-2 gap-x-8 gap-y-5 overflow-y-auto p-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-tertiary">
                {g.title}
              </div>
              <div className="space-y-1.5">
                {g.items.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-ink-muted">{s.label}</span>
                    <span className="flex shrink-0 gap-1">
                      {s.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
