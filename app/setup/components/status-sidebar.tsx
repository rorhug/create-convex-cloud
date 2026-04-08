"use client";

import Link from "next/link";
import { StatusRow } from "./status-row";

export function StatusSidebar({
  canAccessApps,
  hasGitHubConnection,
  hasVercelConnection,
  hasConvexToken,
}: {
  canAccessApps: boolean;
  hasGitHubConnection: boolean;
  hasVercelConnection: boolean;
  hasConvexToken: boolean;
}) {
  return (
    <aside className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Status</h2>
        <StatusRow
          label="GitHub"
          value={hasGitHubConnection ? "Connected" : "Missing"}
        />
        <StatusRow
          label="Vercel"
          value={hasVercelConnection ? "Connected" : "Missing"}
        />
        <StatusRow
          label="Convex"
          value={hasConvexToken ? "Connected" : "Missing"}
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
        <h3 className="text-lg font-medium text-white">Apps access</h3>
        <p className="mt-2 text-sm text-slate-300">
          {canAccessApps
            ? "Everything is connected. You can create apps now."
            : "Finish all three steps before /apps is unlocked."}
        </p>
        <Link
          href="/apps"
          className={`mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-medium transition ${
            canAccessApps
              ? "bg-white text-slate-950 hover:bg-slate-200"
              : "pointer-events-none bg-slate-800 text-slate-500"
          }`}
        >
          Go to /apps
        </Link>
      </div>
    </aside>
  );
}
