"use client";

import { ArrowCircleUpRightIcon } from "@phosphor-icons/react";
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
        <div className="space-y-2 text-sm text-slate-300">
          <p>
            Token saved:{" "}
            <span className="font-medium text-white">{vercel.tokenPreview}</span>
          </p>
          <p>
            Teams:{" "}
            <span className="font-medium text-white">
              {vercel.teams.map((team) => team.name).join(", ")}
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Create a Vercel token, paste it here, verify and save. You will be
              able to select which team to deploy each app to.
            </p>
            <p>
              <a
                href="https://vercel.com/account/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-400 transition hover:text-blue-300"
              >
                vercel.com/account/settings/tokens
                <ArrowCircleUpRightIcon
                  className="size-4 shrink-0"
                  weight="regular"
                />
              </a>
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-slate-700/80 bg-slate-950/80 px-4 py-3">
              <dt className="text-slate-500">Token name</dt>
              <dd className="font-mono text-slate-100">ccc</dd>
              <dt className="text-slate-500">Scope</dt>
              <dd className="text-slate-100">Full Account</dd>
              <dt className="text-slate-500">Expiration</dt>
              <dd className="text-slate-100">No Expiration</dd>
            </dl>
          </div>
          <input
            type="password"
            value={vercelToken}
            onChange={(event) => onTokenChange(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
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
            <button
              type="button"
              className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={busy !== null || vercelToken.trim().length === 0}
              onClick={onVerify}
            >
              {busy === "vercel-verify" ? "Verifying..." : "Verify token"}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                disabled={busy !== null || vercelToken.trim().length === 0}
                onClick={onVerify}
              >
                {busy === "vercel-verify" ? "Verifying..." : "Verify token"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={busy !== null}
                onClick={onSave}
              >
                {busy === "vercel-save" ? "Saving..." : "Save token"}
              </button>
            </div>
          )}
        </div>
      )}
    </StepCard>
  );
}
