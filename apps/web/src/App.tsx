import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Board } from "./components/Board";
import { IssueView } from "./components/IssueView";
import { ReportView } from "./components/ReportView";
import { PRsView } from "./components/PRsView";
import { CommandPalette } from "./components/CommandPalette";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { CreateIssueModal } from "./components/CreateIssueModal";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { GitHubDialog } from "./components/GitHubDialog";
import { MergeModal } from "./components/Notifications";
import { useKeyboard } from "./hooks/useKeyboard";
import { useRoute } from "./store/route";

export function App() {
  useKeyboard();
  const { issueId, reportId, prs } = useRoute();
  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {issueId ? (
          <IssueView issueId={issueId} />
        ) : reportId ? (
          <ReportView reportId={reportId} />
        ) : prs ? (
          <PRsView />
        ) : (
          <>
            <TopBar />
            <div className="min-h-0 flex-1">
              <Board />
            </div>
          </>
        )}
      </main>
      <CommandPalette />
      <ShortcutsHelp />
      <CreateIssueModal />
      <CreateProjectModal />
      <GitHubDialog />
      <MergeModal />
    </div>
  );
}
