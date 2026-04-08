"use client";

import Link from "next/link";
import { GitHubInstallationActions } from "@/components/github-installation-actions";

export type AppsGithubInstallation = {
  id: string;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
};

export type AppsVercelTeam = {
  id: string;
  name?: string | undefined;
  slug: string;
};

export function AppCreationSection({
  error,
  githubInstallationId,
  githubInstallations,
  githubInstallUrl,
  githubRepoVisibility,
  isCreating,
  isRefreshingGithub,
  name,
  onGithubInstallationChange,
  onGithubRepoVisibilityChange,
  onNameChange,
  onRefreshGithubInstallations,
  onSubmit,
  onVercelTeamChange,
  vercelTeamId,
  vercelTeams,
}: {
  error: string | null;
  githubInstallationId: string;
  githubInstallations: AppsGithubInstallation[];
  githubInstallUrl: string;
  githubRepoVisibility: "" | "public" | "private";
  isCreating: boolean;
  isRefreshingGithub: boolean;
  name: string;
  onGithubInstallationChange: (value: string) => void;
  onGithubRepoVisibilityChange: (value: "" | "public" | "private") => void;
  onNameChange: (value: string) => void;
  onRefreshGithubInstallations: () => void;
  onSubmit: () => void;
  onVercelTeamChange: (value: string) => void;
  vercelTeamId: string;
  vercelTeams: AppsVercelTeam[];
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
      <div className="space-y-4">
        {githubInstallations.length === 0 ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            No GitHub App installations on file yet. Add your personal account or
            an organization, then refresh.
          </p>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="github-installation"
            className="block text-sm font-medium text-slate-200"
          >
            GitHub installation
          </label>
          <select
            id="github-installation"
            value={githubInstallationId}
            onChange={(event) => onGithubInstallationChange(event.target.value)}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-slate-500"
          >
            <option value="">Select an installation…</option>
            {githubInstallations.map((installation) => (
              <option key={installation.id} value={installation.id}>
                {installation.accountLogin}
                {installation.accountType.toLowerCase() === "organization"
                  ? " (org)"
                  : " (personal)"}
                {installation.repositorySelection === "selected"
                  ? " - selected repos"
                  : ""}
              </option>
            ))}
          </select>
          <GitHubInstallationActions
            installUrl={githubInstallUrl}
            isRefreshing={isRefreshingGithub}
            disabled={isCreating || isRefreshingGithub}
            onRefresh={onRefreshGithubInstallations}
          />
          <p className="text-xs text-slate-500">
            Choose the personal account or organization that should own and
            authorize the new repo.
          </p>
        </div>

        {vercelTeams.length === 0 ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            No Vercel teams on file (your personal team should appear after you{" "}
            <Link href="/setup" className="underline hover:text-white">
              verify your Vercel token again
            </Link>
            ).
          </p>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="vercel-team"
              className="block text-sm font-medium text-slate-200"
            >
              Vercel team
            </label>
            <select
              id="vercel-team"
              value={vercelTeamId}
              onChange={(event) => onVercelTeamChange(event.target.value)}
              className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-slate-500"
            >
              <option value="">Select a team…</option>
              {vercelTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="github-visibility"
            className="block text-sm font-medium text-slate-200"
          >
            GitHub repository
          </label>
          <select
            id="github-visibility"
            value={githubRepoVisibility}
            onChange={(event) => {
              const value = event.target.value;
              onGithubRepoVisibilityChange(
                value === "public" || value === "private" ? value : "",
              );
            }}
            className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-slate-500"
          >
            <option value="">Public or private…</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <p className="text-xs text-slate-500">
            New repos are created under the selected GitHub installation with
            this visibility.
          </p>
        </div>

        <label className="block text-sm font-medium text-slate-200">
          App name
        </label>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="my-demo-app"
            className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
          />
          <button
            className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={
              isCreating ||
              name.trim().length === 0 ||
              githubInstallations.length === 0 ||
              githubInstallationId === "" ||
              vercelTeams.length === 0 ||
              vercelTeamId === "" ||
              (githubRepoVisibility !== "public" &&
                githubRepoVisibility !== "private")
            }
            onClick={onSubmit}
          >
            {isCreating ? "Creating..." : "Create app"}
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
