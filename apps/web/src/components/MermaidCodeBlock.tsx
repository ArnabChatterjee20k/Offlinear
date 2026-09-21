import * as React from "react";
import CodeBlock from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";

// Lazy-load mermaid (large, pulls in elk) so it only ships when a diagram is
// actually rendered. Initialised once, dark theme tuned to the Linear canvas.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "dark",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        themeVariables: { background: "#010102", primaryColor: "#141516", lineColor: "#8a8f98" },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

/** Node view for code blocks. A ```mermaid block renders as an SVG diagram when
 *  the editor is read-only (Preview); everything else stays an editable code
 *  block. The raw source is always kept in a hidden <code> so it round-trips to
 *  markdown unchanged. */
function MermaidNodeView({ node, editor }: NodeViewProps) {
  const isMermaid = String(node.attrs.language ?? "").toLowerCase() === "mermaid";
  const code = node.textContent;
  const showDiagram = isMermaid && !editor.isEditable;

  const [svg, setSvg] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!showDiagram || !code.trim()) {
      setSvg("");
      setErr(null);
      return;
    }
    let alive = true;
    const id = "m" + Math.random().toString(36).slice(2);
    getMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then(({ svg }) => alive && (setSvg(svg), setErr(null)))
      .catch((e) => alive && setErr(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [showDiagram, code]);

  if (showDiagram) {
    return (
      <NodeViewWrapper className="mermaid-view">
        {err ? (
          <pre className="mermaid-error">
            {"Diagram error: " + err + "\n\n" + code}
          </pre>
        ) : (
          <div className="mermaid-diagram" contentEditable={false} dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        {/* Keep the source in the doc (hidden) so ProseMirror has a contentDOM. */}
        <pre style={{ display: "none" }}>
          <NodeViewContent as="code" />
        </pre>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <pre data-language={node.attrs.language || undefined}>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

/** Default code block + a mermaid-aware node view. */
export const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});
