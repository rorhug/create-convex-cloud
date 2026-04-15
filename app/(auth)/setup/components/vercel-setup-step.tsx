"use client";

import { ArrowCircleUpRightIcon } from "@phosphor-icons/react";
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
  busy,
  onTokenChange,
  onVerify,
  onSave,
}: {
  complete: boolean;
  vercel: {
    teams: SetupVercelTeam[];
    tokenPreview: string;
  } | null;
  vercelToken: string;
  vercelTeams: SetupVercelTeam[] | null;
  busy: SetupBusyState;
  onTokenChange: (value: string) => void;
  onVerify: () => void;
  onSave: () => void;
}) {
  return (
    <StepCard step="2" title="Vercel access token" complete={complete}>
      {vercel ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Token saved:{" "}
            <span className="font-medium text-foreground">{vercel.tokenPreview}</span>
          </p>
          <p>
            Teams:{" "}
            <span className="font-medium text-foreground">
              {vercel.teams.map((team) => team.name).join(", ")}
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Create a Vercel token, paste it here, verify and save. You will be
              able to select which team to deploy each app to.
            </p>
            <p>
              <a
                href="https://vercel.com/account/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary transition hover:underline"
              >
                vercel.com/account/settings/tokens
                <ArrowCircleUpRightIcon
                  className="size-4 shrink-0"
                  weight="regular"
                />
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
          {vercelTeams && (
            <Banner tone="success">
              Token verified. Found {vercelTeams.length} team
              {vercelTeams.length === 1 ? "" : "s"}:{" "}
              {vercelTeams.map((team) => team.name).join(", ")}
            </Banner>
          )}
          {vercelTeams === null ? (
            <Button
              className="w-full"
              disabled={busy !== null || vercelToken.trim().length === 0}
              onClick={onVerify}
            >
              {busy === "vercel-verify" ? "Verifying..." : "Verify token"}
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="shrink-0"
                disabled={busy !== null || vercelToken.trim().length === 0}
                onClick={onVerify}
              >
                {busy === "vercel-verify" ? "Verifying..." : "Verify token"}
              </Button>
              <Button className="flex-1" disabled={busy !== null} onClick={onSave}>
                {busy === "vercel-save" ? "Saving..." : "Save token"}
              </Button>
            </div>
          )}
        </div>
      )}
    </StepCard>
  );
}
