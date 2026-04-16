"use client";

import { GitHubInstallationActions } from "@/components/github-installation-actions";
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
      {complete ? (
        <div className="space-y-4">
          {issue ? <Banner tone="error">{issue}</Banner> : null}
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
                {installation.accountName ? (
                  <div className="text-muted-foreground">{installation.accountName}</div>
                ) : null}
              </div>
            ))}
          </div>
          <GitHubInstallationActions
            installUrl={installUrl}
            isRefreshing={isRefreshing}
            disabled={disabled}
            onRefresh={onRefresh}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {issue ? <Banner tone="error">{issue}</Banner> : null}
          <p className="text-sm text-muted-foreground">
            Install the GitHub App on your personal account or an organization before continuing.
          </p>
          <div className="border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Either <span className="font-medium text-foreground">All repositories</span> or{" "}
            <span className="font-medium text-foreground">Only select repositories</span> will work. If you choose
            selected repos, at least one repository must be selected. Create convex cloud will not use it, but it is
            required by Github to install.
          </div>
          <GitHubInstallationActions
            installUrl={installUrl}
            isRefreshing={isRefreshing}
            disabled={disabled}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </StepCard>
  );
}
