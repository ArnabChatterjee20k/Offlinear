import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { Login } from "./components/Login";
import { db } from "./db/db";
import { ensureSeeded } from "./db/seed";
import { initSync, pullOnce, setAdapter } from "./sync/engine";
import { appwriteConfigured } from "./sync/appwrite-config";
import { AppwriteAdapter } from "./sync/appwrite-adapter";
import { currentAccount, ensureMember } from "./auth";
import { setSession } from "./store/session";
import { useAuth } from "./store/auth";
import { useUI } from "./store/ui";
import { loadNotifications } from "./store/notifications";

/** Pick the project to show on load: the last one, else the first, else prompt
 *  to create one (first-run onboarding). */
async function selectStartupProject() {
  const projects = await db.projects.orderBy("name").toArray();
  if (projects.length === 0) {
    useUI.getState().setCreateProject(true);
    return;
  }
  const last = (await db.meta.get("currentProject"))?.value as string | undefined;
  const chosen = projects.find((p) => p.id === last) ?? projects[0];
  useUI.setState({ currentProjectId: chosen.id });
}

async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  void loadNotifications();
  const render = (node: React.ReactNode) =>
    root.render(<React.StrictMode>{node}</React.StrictMode>);

  if (appwriteConfigured) {
    setAdapter(new AppwriteAdapter());

    // Require a GitHub (Appwrite) session before touching data.
    const user = await currentAccount();
    if (!user) {
      render(<Login />);
      return;
    }

    const memberId = await ensureMember(user);
    useAuth.getState().set({ memberId, name: user.name, email: user.email });
    await pullOnce();

    const team = (await db.teams.toArray())[0] ?? null;
    setSession({ actorId: memberId, teamId: team?.id ?? null });
    initSync();
    await selectStartupProject();

    render(<App />);
    return;
  }

  // Local-only mode: seed IndexedDB from the bundled CSV export.
  await ensureSeeded();
  const members = await db.members.toArray();
  const me =
    members.filter((m) => !m.isAgent).find((m) => m.email.startsWith("arnab")) ??
    members[0] ??
    null;
  const team = (await db.teams.toArray())[0] ?? null;
  if (me) useAuth.getState().set({ memberId: me.id, name: me.name, email: me.email });
  setSession({ actorId: me?.id ?? null, teamId: team?.id ?? null });
  initSync();
  await selectStartupProject();
  render(<App />);
}

bootstrap().catch((e) => {
  document.getElementById("root")!.innerHTML =
    `<div style="color:#f7f8f8;font-family:system-ui;padding:40px">Failed to start: ${String(e)}</div>`;
});
