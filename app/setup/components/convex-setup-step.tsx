"use client";

import { StepCard } from "./step-card";
import type { SetupBusyState } from "./types";

export function ConvexSetupStep({
  complete,
  convex,
  busy,
  onLink,
}: {
  complete: boolean;
  convex: {
    teamId: string;
    tokenPreview: string;
  } | null;
  busy: SetupBusyState;
  onLink: () => void;
}) {
  return (
    <StepCard step="3" title="Link Convex team" complete={complete}>
      {convex ? (
        <div className="space-y-2 text-sm text-slate-300">
          <p>Connected with Convex OAuth.</p>
          <p>
            Team: <span className="font-medium text-white">{convex.teamId}</span>
          </p>
          <p>
            Token preview:{" "}
            <span className="font-medium text-white">{convex.tokenPreview}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Link a Convex team to your existing GitHub user. We will store the
            resulting team-scoped application token for app creation workflows.
          </p>
          <button
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={busy !== null}
            onClick={onLink}
          >
            {busy === "convex" ? "Redirecting..." : "Link Convex"}
          </button>
        </div>
      )}
    </StepCard>
  );
}
