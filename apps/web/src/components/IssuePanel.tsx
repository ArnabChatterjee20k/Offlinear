import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronUp, MoreHorizontal, Trash2, Link2, Archive } from "lucide-react";
import { PRIORITY_LABELS, type Issue } from "@offlinear/shared";
import { PriorityIcon, StateIcon } from "./icons";
import { Avatar } from "./ui/primitives";
import { AssigneePicker, LabelPicker, PriorityPicker, StatePicker } from "./pickers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Comments } from "./Comments";
import { SubIssues } from "./SubIssues";
import { Relations } from "./Relations";
import { NotificationBell } from "./Notifications";
import { RichEditor, type RichEditorHandle } from "./RichEditor";
import { IssuePicker, ReportPicker } from "./LinkPickers";
import { db } from "@/db/db";
import { useIssue, useLookups } from "@/hooks/useData";
import { useUI } from "@/store/ui";
import { deleteIssue, updateIssue } from "@/store/mutations";

function IssueMenu({ issue, onDeleted }: { issue: Issue; onDeleted: () => void }) {
  const copyLink = () =>
    navigator.clipboard?.writeText(`${window.location.origin}/issue/${issue.id}`);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={copyLink}>
          <Link2 className="h-3.5 w-3.5" /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => updateIssue(issue.id, { archivedAt: new Date().toISOString() })}
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger focus:text-danger"
          onSelect={() => {
            void deleteIssue(issue.id);
            onDeleted();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete issue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PropButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2 py-1 text-[12px] text-ink-muted hover:border-hairline-strong hover:text-ink",
      className
    )}
    {...props}
  >
    {children}
  </button>
));
PropButton.displayName = "PropButton";

export function IssueBody({ issue, onBack }: { issue: Issue; onBack: () => void }) {
  const { stateById, memberById, labelById } = useLookups();
  const openIssue = useUI((s) => s.openIssue);
  const parent = useIssue(issue.parentId);

  const [title, setTitle] = React.useState(issue.title);
  const [desc, setDesc] = React.useState(issue.description);
  const editorRef = React.useRef<RichEditorHandle>(null);
  React.useEffect(() => setTitle(issue.title), [issue.id, issue.title]);
  React.useEffect(() => setDesc(issue.description), [issue.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autosave for the description.
  React.useEffect(() => {
    if (desc === issue.description) return;
    const t = setTimeout(() => updateIssue(issue.id, { description: desc }), 500);
    return () => clearTimeout(t);
  }, [desc, issue.id, issue.description]);

  const insertIssueLink = async (id: string) => {
    const i = await db.issues.get(id);
    if (i) editorRef.current?.insertLink(`#${i.key} ${i.title}`, `issue:${id}`);
  };

  const state = stateById.get(issue.stateId);
  const assignee = issue.assigneeId ? memberById.get(issue.assigneeId) : undefined;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2.5">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
          title="Back to board"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <StateIcon state={state} />
        <span className="font-mono text-[12px] text-ink-tertiary">{issue.key}</span>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <IssueMenu issue={issue} onDeleted={onBack} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-6 px-6 py-5">
          {parent && (
            <button
              onClick={() => openIssue(parent.id)}
              className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-subtle"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span className="font-mono">{parent.key}</span>
              <span className="truncate">{parent.title}</span>
            </button>
          )}

          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== issue.title && updateIssue(issue.id, { title: title.trim() })}
            rows={1}
            className="w-full resize-none bg-transparent text-[22px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-tertiary"
            placeholder="Issue title"
          />

          <div>
            <div className="flex items-center gap-1.5">
              <IssuePicker onPick={insertIssueLink} />
              <ReportPicker onPick={(id, name) => editorRef.current?.insertLink(name, `report:${id}`)} />
            </div>
            <RichEditor ref={editorRef} resetKey={issue.id} value={desc} onChange={setDesc} />
          </div>

          <SubIssues parentId={issue.id} />
          <Relations issue={issue} />
          <div className="border-t border-hairline pt-5">
            <Comments issueId={issue.id} />
          </div>
        </div>

        {/* Property sidebar */}
        <div className="w-[230px] shrink-0 space-y-4 border-l border-hairline px-4 py-5">
          <Prop label="Status">
            <StatePicker
              issue={issue}
              trigger={
                <PropButton>
                  <StateIcon state={state} /> {state?.name ?? "—"}
                </PropButton>
              }
            />
          </Prop>
          <Prop label="Priority">
            <PriorityPicker
              issue={issue}
              trigger={
                <PropButton>
                  <PriorityIcon priority={issue.priority} /> {PRIORITY_LABELS[issue.priority]}
                </PropButton>
              }
            />
          </Prop>
          <Prop label="Assignee">
            <AssigneePicker
              issue={issue}
              trigger={
                <PropButton>
                  {assignee ? (
                    <>
                      <Avatar name={assignee.name} size={16} /> {assignee.name}
                    </>
                  ) : (
                    <span className="text-ink-tertiary">Unassigned</span>
                  )}
                </PropButton>
              }
            />
          </Prop>
          <Prop label="Labels">
            <LabelPicker
              issue={issue}
              trigger={
                <PropButton>
                  {issue.labelIds.length ? `${issue.labelIds.length} label(s)` : "Add labels"}
                </PropButton>
              }
            />
            {issue.labelIds.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {issue.labelIds.map((id) => {
                  const l = labelById.get(id);
                  if (!l) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] text-ink-subtle"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
                      {l.name}
                    </span>
                  );
                })}
              </div>
            )}
          </Prop>
        </div>
      </div>
    </>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-ink-tertiary">{label}</div>
      {children}
    </div>
  );
}

