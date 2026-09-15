import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { db } from "./db/db";
import { ensureSeeded } from "./db/seed";
import { initSync } from "./sync/engine";
import { setSession } from "./store/session";

async function bootstrap() {
  await ensureSeeded();

  // Pick a current user (a human) + their team to attribute ops to.
  const members = await db.members.toArray();
  const humans = members.filter((m) => !m.isAgent);
  const me =
    humans.find((m) => m.email.startsWith("arnab")) ?? humans[0] ?? null;
  const team = (await db.teams.toArray())[0] ?? null;
  setSession({ actorId: me?.id ?? null, teamId: team?.id ?? null });

  initSync();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((e) => {
  document.getElementById("root")!.innerHTML =
    `<div style="color:#f7f8f8;font-family:system-ui;padding:40px">Failed to start: ${String(e)}</div>`;
});
