import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { openIssuePage, openReportPage } from "@/store/route";

/**
 * GitHub-flavored markdown rendered with the app's dark tokens. Kept dependency-
 * light: styling is inline via component overrides (no typography plugin).
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-[14px] leading-relaxed text-ink-muted", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mb-2 mt-4 text-[18px] font-semibold text-ink" {...p} />,
          h2: (p) => <h2 className="mb-2 mt-4 text-[16px] font-semibold text-ink" {...p} />,
          h3: (p) => <h3 className="mb-1.5 mt-3 text-[14px] font-semibold text-ink" {...p} />,
          p: (p) => <p className="my-2 first:mt-0 last:mb-0" {...p} />,
          a: ({ href, children, ...p }) => {
            // In-app cross-links: issue:<id> / report:<id>.
            const m = /^(issue|report):(.+)$/.exec(href ?? "");
            if (m) {
              const nav = () =>
                m[1] === "issue" ? openIssuePage(m[2]) : openReportPage(m[2]);
              return (
                <button
                  onClick={nav}
                  className="rounded bg-surface-3 px-1 text-brand hover:text-brand-hover"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                className="text-brand hover:text-brand-hover underline underline-offset-2"
                target="_blank"
                rel="noreferrer noopener"
                {...p}
              >
                {children}
              </a>
            );
          },
          ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
          li: (p) => <li className="marker:text-ink-tertiary" {...p} />,
          code: ({ className: c, children, ...rest }) => {
            const inline = !String(c ?? "").includes("language-");
            return inline ? (
              <code
                className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-ink"
                {...rest}
              >
                {children}
              </code>
            ) : (
              <code className="font-mono text-[12px]" {...rest}>
                {children}
              </code>
            );
          },
          pre: (p) => (
            <pre
              className="my-2 overflow-x-auto rounded-lg border border-hairline bg-surface-2 p-3 text-[12px] text-ink"
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote className="my-2 border-l-2 border-hairline-strong pl-3 text-ink-subtle" {...p} />
          ),
          hr: () => <hr className="my-3 border-hairline" />,
          table: (p) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]" {...p} />
            </div>
          ),
          th: (p) => <th className="border border-hairline px-2 py-1 text-left font-medium text-ink" {...p} />,
          td: (p) => <td className="border border-hairline px-2 py-1" {...p} />,
          input: (p) => <input className="mr-1 align-middle" disabled {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
