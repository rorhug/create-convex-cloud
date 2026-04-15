"use client";

import { Button } from "@/components/ui/button";
import { Banner } from "./banner";
import { StepCard } from "./step-card";
import type { SetupBusyState } from "./types";

export function ConvexSetupStep({
  complete,
  convex,
  busy,
  issue,
  onLink,
}: {
  complete: boolean;
  convex: {
    teamId: string;
    tokenPreview: string;
  } | null;
  busy: SetupBusyState;
  issue: string | null;
  onLink: () => void;
}) {
  return (
    <StepCard step="3" title="Link Convex team" complete={complete}>
      {convex ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          {issue ? <Banner tone="error">{issue}</Banner> : null}
          <p>Connected with Convex OAuth.</p>
          <p>
            Team: <span className="font-medium text-foreground">{convex.teamId}</span>
          </p>
          <p>
            Token preview:{" "}
            <span className="font-medium text-foreground">
              {convex.tokenPreview}
            </span>
          </p>
          {issue ? (
            <div>
              <Button disabled={busy !== null} onClick={onLink}>
                {busy === "convex" ? "Redirecting..." : "Reconnect Convex"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link a Convex team to your existing GitHub user. We will store the
            resulting team-scoped application token for app creation workflows.
          </p>
          <Button disabled={busy !== null} onClick={onLink}>
            {busy === "convex" ? "Redirecting..." : "Link Convex"}
          </Button>
        </div>
      )}
    </StepCard>
  );
}
