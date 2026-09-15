import { IssueBody } from "./IssuePanel";
import { useIssue } from "@/hooks/useData";
import { openIssuePage } from "@/store/route";

/** Full-page issue view (route /issue/:id). */
export function IssueView({ issueId }: { issueId: string }) {
  const issue = useIssue(issueId);
  const back = () => openIssuePage(null);

  if (!issue) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-subtle">
        <p className="text-[14px]">Issue not found.</p>
        <button onClick={back} className="text-[13px] text-brand hover:text-brand-hover">
          Back to board
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <IssueBody issue={issue} onBack={back} />
    </div>
  );
}
