"use client";

import { GitHubInstallationActions } from "@/components/github-installation-actions";
import { StepCard } from "./step-card";
import type { SetupGithubInstallation } from "./types";

export function GitHubSetupStep({
  complete,
  installations,
  installUrl,
  isRefreshing,
  disabled,
  onRefresh,
}: {
  complete: boolean;
  installations: SetupGithubInstallation[];
  installUrl: string;
  isRefreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <StepCard step="1" title="GitHub app" complete={complete}>
      {complete ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Installed for {installations.length} account
            {installations.length === 1 ? "" : "s"}.
          </p>
          <div className="space-y-2">
            {installations.map((installation) => (
              <div
                key={installation.id}
                className="border border-border bg-muted/50 px-4 py-3 text-sm"
              >
                <div className="font-medium">
                  {installation.accountLogin}
                  {installation.accountType.toLowerCase() === "organization"
                    ? " (org)"
                    : " (personal)"}
                </div>
                {installation.accountName ? (
                  <div className="text-muted-foreground">
                    {installation.accountName}
                  </div>
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
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Install the GitHub App on your personal account or an organization
            before continuing.
          </p>
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
