"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { SetupBusyState } from "./types";

export function GitHubPagesDeploymentTab({
  isGithubAppInstalled,
  isGithubPagesConfirmed,
  installUrl,
  busy,
  onConfirm,
}: {
  isGithubAppInstalled: boolean;
  isGithubPagesConfirmed: boolean;
  installUrl: string;
  busy: SetupBusyState;
  onConfirm: () => void;
}) {
  if (!isGithubAppInstalled) {
    return (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>Hosting your application on GitHub Pages requires GitHub App installation in Step 1.</p>
        <div className="flex flex-wrap gap-3">
          <Button disabled>Confirm Deployment to GitHub Pages</Button>
          <Button asChild variant="outline" className="cursor-pointer text-foreground">
            <a href={installUrl} target="_blank" rel="noopener noreferrer">
              Install GitHub App
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (isGithubPagesConfirmed) {
    return (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p className="inline-flex items-center gap-2 text-foreground">
          <CheckCircleIcon weight="fill" className="size-5 text-primary" />
          Deployment to GitHub Pages is confirmed.
        </p>
        <p>
          GitHub repository will be automatically created and your app published to GitHub Pages with no extra costs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>
        GitHub repository will be automatically created and your app published to GitHub Pages with no extra costs.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button className="cursor-pointer" disabled={busy !== null} onClick={onConfirm}>
          {busy === "github-pages-confirm" ? "Confirming..." : "Confirm Deployment to GitHub Pages"}
        </Button>
      </div>
    </div>
  );
}
