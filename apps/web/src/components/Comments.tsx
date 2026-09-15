import * as React from "react";
import { Bot, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/time";
import { Avatar } from "./ui/primitives";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import { useComments, useLookups } from "@/hooks/useData";
import { addComment, deleteComment, editComment } from "@/store/mutations";

export function Comments({ issueId }: { issueId: string }) {
  const comments = useComments(issueId);
  const { memberById } = useLookups();
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    void addComment(issueId, body);
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-medium text-ink-subtle">
        Comments {comments.length > 0 && <span className="text-ink-tertiary">· {comments.length}</span>}
      </h3>

      <div className="space-y-3">
        {comments.map((c) => {
          const author = c.authorId ? memberById.get(c.authorId) : undefined;
          const isAgent = c.source === "agent";
          return (
            <div key={c.id} className="group flex gap-2.5">
              {isAgent ? (
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Bot className="h-3 w-3" />
                </span>
              ) : (
                <Avatar name={author?.name} size={20} className="mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">
                    {isAgent ? "Agent" : author?.name ?? "Unknown"}
                  </span>
                  <span className="text-[11px] text-ink-tertiary">{relTime(c.createdAt)}</span>
                  {c.updatedAt !== c.createdAt && (
                    <span className="text-[11px] text-ink-tertiary">(edited)</span>
                  )}
                  <div className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      className="rounded p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink"
                      onClick={() => {
                        setEditing(c.id);
                        setEditText(c.body);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="rounded p-1 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
                      onClick={() => deleteComment(c.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {editing === c.id ? (
                  <div className="mt-1 space-y-1.5">
                    <Textarea
                      value={editText}
                      rows={3}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          void editComment(c.id, editText.trim());
                          setEditing(null);
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          void editComment(c.id, editText.trim());
                          setEditing(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className={cn("mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted")}>
                    {c.body}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Textarea
          placeholder="Leave a comment…"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-tertiary">⌘↵ to comment</span>
          <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={submit}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
