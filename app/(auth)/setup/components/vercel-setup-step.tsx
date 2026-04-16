"use client";

import { ArrowCircleUpRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "./banner";
import { ProviderLogoName } from "./provider-logo";
import { StepCard } from "./step-card";
import type { SetupBusyState, SetupVercelTeam } from "./types";

export function VercelSetupStep({
  complete,
  vercel,
  vercelToken,
  showReplaceToken,
  busy,
  issue,
  onTokenChange,
  onRefresh,
  onSave,
  onToggleReplaceToken,
}: {
  complete: boolean;
  vercel: {
    teams: SetupVercelTeam[];
    tokenPreview: string;
    isValid: boolean;
    issue: string | null;
  } | null;
  vercelToken: string;
  showReplaceToken: boolean;
  busy: SetupBusyState;
  issue: string | null;
  onTokenChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  onToggleReplaceToken: () => void;
}) {
  const showTokenEntryFields = vercel === null || !vercel.isValid || showReplaceToken;

  return (
    <StepCard step="2" provider={ProviderLogoName.Vercel} complete={complete}>
      <div className="space-y-4 text-sm text-muted-foreground">
        {vercel ? (
          <p>
            Token saved: <span className="font-medium text-foreground">{vercel.tokenPreview}</span>
          </p>
        ) : null}

        {issue ? <Banner tone="error">{issue}</Banner> : null}

        {showTokenEntryFields ? (
          <div className={vercel ? "space-y-4 border border-border bg-background p-4" : "space-y-4"}>
            {vercel && !vercel.isValid ? (
              <p>Paste a replacement token and save it to restore app creation and Vercel refreshes.</p>
            ) : null}
            <TokenEntryFields
              vercelToken={vercelToken}
              busy={busy}
              onTokenChange={onTokenChange}
              onSave={onSave}
              onKeepExisting={vercel?.isValid ? onToggleReplaceToken : undefined}
            />
          </div>
        ) : null}

        {vercel?.teams.length && !showTokenEntryFields ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Available orgs</p>
            <div className="space-y-2">
              {vercel.teams.map((team) => (
                <div key={team.id} className="border border-border bg-muted/50 px-4 py-3 text-sm">
                  <div className="font-medium text-foreground">{team.name}</div>
                  <div className="text-muted-foreground">{team.slug}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {vercel && !showTokenEntryFields ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="text-foreground" disabled={busy !== null} onClick={onRefresh}>
              {busy === "vercel-refresh" ? "Refreshing..." : "Refresh Vercel"}
            </Button>
            {vercel.isValid ? (
              <Button variant="outline" className="text-foreground" onClick={onToggleReplaceToken}>
                Replace token
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </StepCard>
  );
}

function TokenEntryFields({
  vercelToken,
  busy,
  onTokenChange,
  onSave,
  onKeepExisting,
}: {
  vercelToken: string;
  busy: SetupBusyState;
  onTokenChange: (value: string) => void;
  onSave: () => void;
  onKeepExisting?: () => void;
}) {
  return (
    <>
      <div className="space-y-3 text-sm">
        <p>
          Create a Vercel token, paste it here and save. You will be able to select which team to deploy each
          app to.
        </p>
        <p>
          <a
            href="https://vercel.com/account/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary transition hover:underline"
          >
            vercel.com/account/settings/tokens
            <ArrowCircleUpRightIcon className="size-4 shrink-0" weight="regular" />
          </a>
        </p>
        <dl className="flex flex-col gap-2 border border-border bg-muted/50 px-4 py-3 md:flex-row md:gap-6">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Token name</dt>
            <dd className="font-mono text-foreground">ccc</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Scope</dt>
            <dd className="text-foreground">Full Account</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Expiration</dt>
            <dd className="text-foreground">No Expiration</dd>
          </div>
        </dl>
      </div>
      <Input
        type="password"
        value={vercelToken}
        onChange={(event) => onTokenChange(event.target.value)}
        placeholder="Paste Vercel access token"
      />
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy !== null || vercelToken.trim().length === 0}
          onClick={onSave}
        >
          {busy === "vercel-save" ? "Saving..." : "Save token"}
        </Button>
        {onKeepExisting ? (
          <Button variant="outline" className="text-foreground" onClick={onKeepExisting}>
            Keep existing token
          </Button>
        ) : null}
      </div>
    </>
  );
}
