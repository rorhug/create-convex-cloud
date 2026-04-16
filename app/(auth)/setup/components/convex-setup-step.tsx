"use client";

import { Button } from "@/components/ui/button";
import { Banner } from "./banner";
import { ProviderLogoName } from "./provider-logo";
import { StepCard } from "./step-card";
import type { SetupBusyState } from "./types";

export function ConvexSetupStep({
  complete,
  convex,
  busy,
  issue,
  onRefresh,
  onLink,
}: {
  complete: boolean;
  convex: {
    teamId: string;
    tokenPreview: string;
  } | null;
  busy: SetupBusyState;
  issue: string | null;
  onRefresh: () => void;
  onLink: () => void;
}) {
  return (
    <StepCard step="3" provider={ProviderLogoName.Convex} complete={complete}>
      {convex ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          {issue ? <Banner tone="error">{issue}</Banner> : null}
          <p>Connected with Convex OAuth.</p>
          <p>
            Team: <span className="font-medium text-foreground">{convex.teamId}</span>
          </p>
          <p>
            Token preview: <span className="font-medium text-foreground">{convex.tokenPreview}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="text-foreground" disabled={busy !== null} onClick={onRefresh}>
              {busy === "convex-refresh" ? "Refreshing..." : "Refresh Convex"}
            </Button>
            <Button variant="outline" className="text-foreground" disabled={busy !== null} onClick={onLink}>
              {busy === "convex" ? "Redirecting..." : "Reconnect Convex"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link a Convex team to your existing GitHub user. We will store the resulting team-scoped application token
            for app creation workflows.
          </p>
          <Button disabled={busy !== null} onClick={onLink}>
            {busy === "convex" ? "Redirecting..." : "Link Convex"}
          </Button>
        </div>
      )}
    </StepCard>
  );
}
