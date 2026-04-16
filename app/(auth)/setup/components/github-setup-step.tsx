"use client";

import { Button } from "@/components/ui/button";
import { Banner } from "./banner";
import { ProviderLogoName } from "./provider-logo";
import { StepCard } from "./step-card";
import type { SetupGithubInstallation } from "./types";

export function GitHubSetupStep({
  complete,
  installations,
  installUrl,
  issue,
  isRefreshing,
  disabled,
  onRefresh,
}: {
  complete: boolean;
  installations: SetupGithubInstallation[];
  installUrl: string;
  issue: string | null;
  isRefreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <StepCard step="1" provider={ProviderLogoName.GitHub} complete={complete}>
      <div className="space-y-4">
        {issue ? <Banner tone="error">{issue}</Banner> : null}

        {complete ? (
          <>
            <p className="text-sm text-muted-foreground">
              Installed for {installations.length} account
              {installations.length === 1 ? "" : "s"}.
            </p>
            <div className="space-y-2">
              {installations.map((installation) => (
                <div key={installation.id} className="border border-border bg-muted/50 px-4 py-3 text-sm">
                  <div className="font-medium">
                    {installation.accountLogin}
                    {installation.accountType.toLowerCase() === "organization" ? " (org)" : " (personal)"}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Install the GitHub App on your personal account or an organization before continuing.
            </p>
            <div className="border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              Either <span className="font-medium text-foreground">All repositories</span> or{" "}
              <span className="font-medium text-foreground">Only select repositories</span> will work. If you choose
              selected repos, at least one repository must be selected. Create convex cloud will not use it, but it is
              required by Github to install.
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild variant={complete ? "outline" : "default"}>
            <a href={installUrl} target="_blank" rel="noopener noreferrer">
              {complete ? "Add orgs / repos" : "Install GitHub App"}
            </a>
          </Button>
          <Button variant="outline" className="text-foreground" disabled={disabled} onClick={onRefresh}>
            {isRefreshing ? "Refreshing..." : "Refresh GitHub"}
          </Button>
        </div>
      </div>
    </StepCard>
  );
}
