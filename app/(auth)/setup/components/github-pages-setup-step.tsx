"use client";

import { Button } from "@/components/ui/button";

export function GitHubPagesDeploymentTab({
  isGithubAppInstalled,
  installUrl,
}: {
  isGithubAppInstalled: boolean;
  installUrl: string;
}) {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      {isGithubAppInstalled ? (
        <p>Automatically create a GitHub repository for your app and publish it to GitHub Pages.</p>
      ) : (
        <p>Hosting your application on GitHub Pages requires GitHub App installation in Step 1.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={!isGithubAppInstalled}
          className={isGithubAppInstalled ? "cursor-pointer" : undefined}
        >
          Create GitHub Pages
        </Button>
        {!isGithubAppInstalled ? (
          <Button asChild variant="outline" className="cursor-pointer text-foreground">
            <a href={installUrl} target="_blank" rel="noopener noreferrer">
              Install GitHub App
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
