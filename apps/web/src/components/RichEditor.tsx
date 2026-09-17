import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  Quote,
  Strikethrough,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
 *  and our renderer, and keeps issue:/report: cross-links). */
export const RichEditor = React.forwardRef<
  RichEditorHandle,
  { value: string; onChange: (markdown: string) => void; resetKey: string }
>(({ value, onChange, resetKey }, ref) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      Placeholder.configure({ placeholder: "Write here…  Use the buttons to link an issue or report." }),
      Markdown.configure({ html: false, linkify: false, transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose-none max-w-none min-h-[50vh] outline-none text-[15px] leading-relaxed text-ink-muted",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  // Reset content when switching to a different report.
  React.useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(value, false);
    }
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

  return (
    <div className="mt-3">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="tiptap mt-2" onClickCapture={onLinkClick} />
    </div>
  );
});
RichEditor.displayName = "RichEditor";

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink",
        active && "bg-surface-2 text-ink"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render on selection changes so active states update.
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    editor.on("selectionUpdate", force);
    editor.on("transaction", force);
    return () => {
      editor.off("selectionUpdate", force);
      editor.off("transaction", force);
    };
  }, [editor]);

  const c = editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-hairline bg-surface-1 p-1">
      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => c.toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => c.toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => c.toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </Btn>
      <span className="mx-1 h-4 w-px bg-hairline" />
      <Btn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => c.toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </Btn>
      <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => c.toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Btn>
      <span className="mx-1 h-4 w-px bg-hairline" />
      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => c.toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => c.toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <Btn title="Quote" active={editor.isActive("blockquote")} onClick={() => c.toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </Btn>
      <Btn title="Code block" active={editor.isActive("codeBlock")} onClick={() => c.toggleCodeBlock().run()}>
        <Code className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}
