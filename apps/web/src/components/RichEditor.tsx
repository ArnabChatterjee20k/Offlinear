import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { openIssuePage, openReportPage } from "@/store/route";
import { uploadAttachment } from "@/lib/uploads";

/** Parse a markdown string in BLOCK mode and insert it at the selection as real
 *  nodes. We go through ProseMirror's DOMParser directly rather than
 *  editor.commands.insertContent — tiptap-markdown patches insertContent to
 *  re-parse in {inline:true} mode, which is meant for inline snippets, so a
 *  full multi-block document (headings, fenced code, lists) round-trips more
 *  faithfully this way. */
function insertMarkdown(editor: Editor, markdown: string) {
  const html = editor.storage.markdown.parser.parse(markdown); // block-mode HTML
  const body = new window.DOMParser().parseFromString(html, "text/html").body;
  const slice = PMDOMParser.fromSchema(editor.schema).parseSlice(body, { preserveWhitespace: true });
  const { state, view } = editor;
  view.focus();
  view.dispatch(state.tr.replaceSelection(slice).scrollIntoView());
}

/** Heuristic: does this pasted text look like markdown we should parse rather
 *  than insert verbatim? Covers headings, fences, lists, tables, quotes,
 *  bold/italic, links/images. */
function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s|```|(^|\n)\s*[-*+]\s|(^|\n)\s*\d+\.\s|(^|\n)\s*>\s|(^|\n)\s*\|.*\|/.test(text) ||
    /\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)/.test(text);
}

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
  /** Upload files and insert them (image → image node, else a link). */
  insertFiles: (files: FileList | File[]) => void;
}

/** Upload each file and insert it into the editor. */
async function insertUploads(editor: Editor, files: File[]) {
  for (const file of files) {
    try {
      const up = await uploadAttachment(file);
      if (up.isImage) editor.chain().focus().setImage({ src: up.url, alt: up.name }).run();
      else
        editor
          .chain()
          .focus()
          .insertContent({ type: "text", text: up.name, marks: [{ type: "link", attrs: { href: up.url } }] })
          .insertContent(" ")
          .run();
    } catch (e) {
      console.error("[upload] failed", e);
    }
  }
}

/** TipTap WYSIWYG editor whose value is markdown (so it round-trips to gists
 *  and our renderer, and keeps issue:/report: cross-links). No toolbar —
 *  formatting via markdown shortcuts (# , - , **bold**, > , ``` …). */
export const RichEditor = React.forwardRef<
  RichEditorHandle,
  { value: string; onChange: (markdown: string) => void; resetKey: string; editable?: boolean }
>(({ value, onChange, resetKey, editable = true }, ref) => {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: false }),
      Image,
      Placeholder.configure({ placeholder: "Write here…" }),
      Markdown.configure({ html: false, linkify: false, transformPastedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "max-w-none min-h-[50vh] outline-none text-[15px] leading-relaxed text-ink-muted",
      },
      handlePaste: (_view, event) => {
        const cd = event.clipboardData;
        const text = cd?.getData("text/plain") ?? "";
        const files = Array.from(cd?.files ?? []);
        // Text-first: parse pasted markdown into real nodes (tiptap-markdown's
        // clipboardTextParser is skipped whenever the clipboard also carries
        // HTML, which it usually does). Take this before the file branch so a
        // synthetic .md/text blob some apps attach isn't uploaded to Storage.
        if (text.trim() && looksLikeMarkdown(text) && editor) {
          event.preventDefault();
          insertMarkdown(editor, text);
          return true;
        }
        // Real image/file paste (screenshots, copied files) → upload.
        if (files.length && !text.trim() && editor) {
          event.preventDefault();
          void insertUploads(editor, files);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const text = dt?.getData("text/plain") ?? "";
        const files = Array.from(dt?.files ?? []);
        if (files.length && editor) {
          event.preventDefault();
          void insertUploads(editor, files);
          return true;
        }
        if (text.trim() && looksLikeMarkdown(text) && editor) {
          event.preventDefault();
          insertMarkdown(editor, text);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  // Reset content when switching to a different report/issue.
  React.useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(value, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  // Toggle read-only (preview) without recreating the editor.
  React.useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(editable);
  }, [editable, editor]);

  React.useImperativeHandle(ref, () => ({
    insertLink: (label, href) => {
      editor
        ?.chain()
        .focus()
        .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href } }] })
        .insertContent(" ")
        .run();
    },
    insertFiles: (files) => {
      if (editor) void insertUploads(editor, Array.from(files));
    },
  }));

  if (!editor) return null;
  return <EditorContent editor={editor} className="tiptap mt-3" onClickCapture={onLinkClick} />;
});
RichEditor.displayName = "RichEditor";
