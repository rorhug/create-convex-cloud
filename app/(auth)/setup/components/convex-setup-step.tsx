"use client";

import { Button } from "@/components/ui/button";
import { Banner } from "./banner";
import { ProviderLogoName } from "./provider-logo";
import { StepCard } from "./step-card";
import type { SetupBusyState, SetupConvexTeam } from "./types";

export function ConvexSetupStep({
  complete,
  convex,
  busy,
  onRefresh,
  onLink,
}: {
  complete: boolean;
  convex: {
    teams: SetupConvexTeam[];
  } | null;
  busy: SetupBusyState;
  onRefresh: () => void;
  onLink: () => void;
}) {
  const teams = convex?.teams ?? [];

  return (
    <StepCard step="3" provider={ProviderLogoName.Convex} complete={complete}>
      {teams.length > 0 ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          <ul className="space-y-3">
            {teams.map((team) => (
              <li key={team.teamId} className="space-y-1">
                <p>
                  Team: <span className="font-medium text-foreground">{team.teamSlug || team.teamId}</span>
                </p>
                <p>
                  Token preview: <span className="font-medium text-foreground">{team.tokenPreview}</span>
                </p>
                {team.issue ? <Banner tone="error">{team.issue}</Banner> : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="text-foreground" disabled={busy !== null} onClick={onRefresh}>
              {busy === "convex-refresh" ? "Refreshing..." : "Refresh Convex"}
            </Button>
            <Button variant="outline" className="text-foreground" disabled={busy !== null} onClick={onLink}>
              {busy === "convex" ? "Redirecting..." : "Link another Convex team"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Link your Convex team to allow creation of new projects.</p>
          <Button disabled={busy !== null} onClick={onLink}>
            {busy === "convex" ? "Redirecting..." : "Link Convex"}
          </Button>
        </div>
      )}
    </StepCard>
  );
}
