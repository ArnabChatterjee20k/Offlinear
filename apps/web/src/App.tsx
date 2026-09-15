import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Board } from "./components/Board";
import { IssuePanel } from "./components/IssuePanel";
import { CommandPalette } from "./components/CommandPalette";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { useKeyboard } from "./hooks/useKeyboard";

export function App() {
  useKeyboard();
  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="min-h-0 flex-1">
          <Board />
        </div>
      </main>
      <IssuePanel />
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  );
}
