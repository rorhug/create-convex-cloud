"use client";

import { ArrowCircleUpRightIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";

export function GitHubPagesDeploymentTab({
  token,
  username,
  onTokenChange,
  onUsernameChange,
}: {
  token: string;
  username: string;
  onTokenChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <div className="space-y-3 text-sm">
        <p>
          Create a GitHub personal access token with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">repo</code> and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">workflow</code> scopes,
          paste it here and save.
        </p>
        <p>
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary transition hover:underline"
          >
            github.com/settings/tokens
            <ArrowCircleUpRightIcon className="size-4 shrink-0" weight="regular" />
          </a>
        </p>
        <dl className="flex flex-col gap-2 border border-border bg-muted/50 px-4 py-3 md:flex-row md:gap-6">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Token type</dt>
            <dd className="text-foreground">Classic</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Scopes</dt>
            <dd className="font-mono text-foreground">repo, workflow</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Expiration</dt>
            <dd className="text-foreground">No expiration</dd>
          </div>
        </dl>
      </div>
      <Input
        type="password"
        value={token}
        onChange={(event) => onTokenChange(event.target.value)}
        placeholder="Paste GitHub personal access token"
      />
      <Input
        type="text"
        value={username}
        onChange={(event) => onUsernameChange(event.target.value)}
        placeholder="GitHub username or organization"
      />
    </div>
  );
}
