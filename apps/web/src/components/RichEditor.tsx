import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { openIssuePage, openReportPage } from "@/store/route";

/** Intercept clicks on issue:/report: links so they navigate in-app. */
function onLinkClick(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  const m = /^(issue|report):(.+)$/.exec(a.getAttribute("href") ?? "");
  if (m) {
    e.preventDefault();
    m[1] === "issue" ? openIssuePage(m[2]) : openReportPage(m[2]);
  }
}

export interface RichEditorHandle {
  /** Insert linked text at the cursor (used for issue/report cross-links). */
  insertLink: (label: string, href: string) => void;
}

/** TipTap WYSIWYG editor whose value is markdown (so it round-trips to gists
 *  and our renderer, and keeps issue:/report: cross-links). No toolbar —
 *  formatting via markdown shortcuts (# , - , **bold**, > , ``` …). */
export const RichEditor = React.forwardRef<
  RichEditorHandle,
  { value: string; onChange: (markdown: string) => void; resetKey: string }
>(({ value, onChange, resetKey }, ref) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: "Write here…" }),
      Markdown.configure({ html: false, linkify: false, transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "max-w-none min-h-[50vh] outline-none text-[15px] leading-relaxed text-ink-muted",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  // Reset content when switching to a different report/issue.
  React.useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  React.useImperativeHandle(ref, () => ({
    insertLink: (label, href) => {
      editor
        ?.chain()
        .focus()
        .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href } }] })
        .insertContent(" ")
        .run();
    },
  }));

  if (!editor) return null;
  return <EditorContent editor={editor} className="tiptap mt-3" onClickCapture={onLinkClick} />;
});
RichEditor.displayName = "RichEditor";
