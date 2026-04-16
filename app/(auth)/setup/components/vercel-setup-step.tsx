"use client";

import { ArrowCircleDownIcon, ArrowCircleRightIcon, ArrowCircleUpRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "./banner";
import { StepCard } from "./step-card";
import type { SetupBusyState, SetupVercelTeam } from "./types";

export function VercelSetupStep({
  complete,
  vercel,
  vercelToken,
  vercelTeams,
  showReplaceToken,
  busy,
  issue,
  onTokenChange,
  onRefresh,
  onVerify,
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
  vercelTeams: SetupVercelTeam[] | null;
  showReplaceToken: boolean;
  busy: SetupBusyState;
  issue: string | null;
  onTokenChange: (value: string) => void;
  onRefresh: () => void;
  onVerify: () => void;
  onSave: () => void;
  onToggleReplaceToken: () => void;
}) {
  const showTokenEntryFields = vercel === null || !vercel.isValid || showReplaceToken;

  return (
    <StepCard step="2" title="Vercel access token" complete={complete}>
      <div className="space-y-4 text-sm text-muted-foreground">
        {vercel ? (
          <>
            <p>
              Token saved: <span className="font-medium text-foreground">{vercel.tokenPreview}</span>
            </p>
            {vercel.isValid ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                onClick={onToggleReplaceToken}
              >
                {showReplaceToken ? (
                  <ArrowCircleDownIcon className="size-3.5" weight="fill" />
                ) : (
                  <ArrowCircleRightIcon className="size-3.5" weight="fill" />
                )}
                Replace token
              </button>
            ) : null}
          </>
        ) : null}

        {issue ? <Banner tone="error">{issue}</Banner> : null}

        {showTokenEntryFields ? (
          <div className={vercel ? "space-y-4 border border-border bg-background p-4" : "space-y-4"}>
            {vercel && !vercel.isValid ? (
              <p>Paste a replacement token, verify it, then save it to restore app creation and Vercel refreshes.</p>
            ) : null}
            <TokenEntryFields
              vercelToken={vercelToken}
              vercelTeams={vercelTeams}
              busy={busy}
              onTokenChange={onTokenChange}
              onVerify={onVerify}
              onSave={onSave}
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
          <div>
            <Button variant="outline" className="text-foreground" disabled={busy !== null} onClick={onRefresh}>
              {busy === "vercel-refresh" ? "Refreshing..." : "Refresh orgs"}
            </Button>
          </div>
        ) : null}
      </div>
    </StepCard>
  );
}

function TokenEntryFields({
  vercelToken,
  vercelTeams,
  busy,
  onTokenChange,
  onVerify,
  onSave,
}: {
  vercelToken: string;
  vercelTeams: SetupVercelTeam[] | null;
  busy: SetupBusyState;
  onTokenChange: (value: string) => void;
  onVerify: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Create a Vercel token, paste it here, verify and save. You will be able to select which team to deploy each
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
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border border-border bg-muted/50 px-4 py-3">
          <dt className="text-muted-foreground">Token name</dt>
          <dd className="font-mono text-foreground">ccc</dd>
          <dt className="text-muted-foreground">Scope</dt>
          <dd className="text-foreground">Full Account</dd>
          <dt className="text-muted-foreground">Expiration</dt>
          <dd className="text-foreground">No Expiration</dd>
        </dl>
      </div>
      <Input
        type="password"
        value={vercelToken}
        onChange={(event) => onTokenChange(event.target.value)}
        placeholder="Paste Vercel access token"
      />
      <div className="flex gap-3">
        <Button
          variant={vercelTeams === null ? "default" : "outline"}
          className={vercelTeams === null ? "flex-1" : "shrink-0"}
          disabled={busy !== null || vercelToken.trim().length === 0}
          onClick={onVerify}
        >
          {busy === "vercel-verify" ? "Verifying..." : "Verify token"}
        </Button>
        {vercelTeams !== null && (
          <Button className="flex-1" disabled={busy !== null} onClick={onSave}>
            {busy === "vercel-save" ? "Saving..." : "Save token"}
          </Button>
        )}
      </div>
      {vercelTeams && (
        <div className="space-y-3">
          <Banner tone="success">
            Token verified. Found {vercelTeams.length} team
            {vercelTeams.length === 1 ? "" : "s"}.
          </Banner>
          <div className="space-y-2">
            {vercelTeams.map((team) => (
              <div key={team.id} className="border border-border bg-muted/50 px-4 py-3 text-sm">
                <div className="font-medium text-foreground">{team.name}</div>
                <div className="text-muted-foreground">{team.slug}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
