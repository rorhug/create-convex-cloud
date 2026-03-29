"use client";

import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { type ReactNode, useState } from "react";

export default function Home() {
  const viewer = useQuery(api.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm text-slate-400">Loading your workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-6 md:p-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Create Convex Cloud
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Connect GitHub, Vercel, and Convex
            </h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Finish the three onboarding steps below, then head to{" "}
              <code>/apps</code> to create apps.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {viewer.onboarding.canAccessApps && (
              <Link
                href="/apps"
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
              >
                Open apps
              </Link>
            )}
            <SignOutButton />
          </div>
        </header>

        <Content viewer={viewer} />
      </div>
    </main>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button
      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
      onClick={() => {
        void signOut();
      }}
    >
      Sign out
    </button>
  );
}

type ViewerState = {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    githubUsername: string | null;
  };
  vercel: {
    teams: Array<{ id: string; name: string; slug: string }>;
    tokenPreview: string;
  } | null;
  convex: {
    teamId: string;
    tokenPreview: string;
  } | null;
  onboarding: {
    hasGitHubConnection: boolean;
    hasVercelConnection: boolean;
    hasConvexToken: boolean;
    canAccessApps: boolean;
  };
};

function Content({ viewer }: { viewer: ViewerState }) {
  const { signIn } = useAuthActions();
  const verifyVercelToken = useAction(api.vercel.verifyVercelToken);
  const saveVercelToken = useMutation(api.vercel.saveVercelToken);

  const [vercelToken, setVercelToken] = useState("");
  const [vercelTeams, setVercelTeams] = useState<
    Array<{ id: string; name: string; slug: string }> | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "github" | "vercel-verify" | "vercel-save" | "convex" | null
  >(null);

  async function handleVerifyVercelToken() {
    setBusy("vercel-verify");
    setError(null);
    try {
      const result = await verifyVercelToken({ token: vercelToken.trim() });
      setVercelTeams(result.teams);
    } catch (verifyError) {
      setVercelTeams(null);
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Could not verify the Vercel token",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveVercelToken() {
    if (!vercelTeams) {
      setError("Verify the token first");
      return;
    }
    setBusy("vercel-save");
    setError(null);
    try {
      await saveVercelToken({
        token: vercelToken.trim(),
        teams: vercelTeams,
      });
      setVercelToken("");
      setVercelTeams(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the Vercel token",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            Signed in as{" "}
            {viewer.user.githubUsername ??
              viewer.user.email ??
              viewer.user.name ??
              "GitHub user"}
          </p>
          <h2 className="text-2xl font-semibold text-white">
            Onboarding checklist
          </h2>
        </div>

        {error && <Banner tone="error">{error}</Banner>}

        {/* Step 1: GitHub */}
        <StepCard
          step="1"
          title="GitHub login"
          complete={viewer.onboarding.hasGitHubConnection}
        >
          {viewer.onboarding.hasGitHubConnection ? (
            <p className="text-sm text-slate-300">
              Connected as {viewer.user.githubUsername ?? viewer.user.name ?? "GitHub user"}. Repo access granted.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Sign in with GitHub to grant repo access.
              </p>
              <button
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={busy !== null}
                onClick={() => {
                  void (async () => {
                    setBusy("github");
                    setError(null);
                    try {
                      const result = await signIn("github", { redirectTo: "/" });
                      if (result.redirect) {
                        window.location.href = result.redirect.toString();
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not connect GitHub");
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
              >
                Connect GitHub
              </button>
            </div>
          )}
        </StepCard>

        {/* Step 2: Vercel token paste */}
        <StepCard
          step="2"
          title="Vercel access token"
          complete={viewer.onboarding.hasVercelConnection}
        >
          {viewer.vercel ? (
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                Token saved: <span className="font-medium text-white">{viewer.vercel.tokenPreview}</span>
              </p>
              <p>
                Teams:{" "}
                <span className="font-medium text-white">
                  {viewer.vercel.teams.map((t) => t.name).join(", ")}
                </span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Create a token at{" "}
                <a
                  href="https://vercel.com/account/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  vercel.com/account/settings/tokens
                </a>{" "}
                and paste it below.
              </p>
              <input
                type="password"
                value={vercelToken}
                onChange={(event) => {
                  setVercelToken(event.target.value);
                  setVercelTeams(null);
                  setError(null);
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
                placeholder="Paste Vercel access token"
              />
              {vercelTeams && (
                <Banner tone="success">
                  Token verified. Found {vercelTeams.length} team
                  {vercelTeams.length === 1 ? "" : "s"}:{" "}
                  {vercelTeams.map((t) => t.name).join(", ")}
                </Banner>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  disabled={busy !== null || vercelToken.trim().length === 0}
                  onClick={() => {
                    void handleVerifyVercelToken();
                  }}
                >
                  {busy === "vercel-verify" ? "Verifying..." : "Verify token"}
                </button>
                <button
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                  disabled={busy !== null || vercelTeams === null}
                  onClick={() => {
                    void handleSaveVercelToken();
                  }}
                >
                  {busy === "vercel-save" ? "Saving..." : "Save token"}
                </button>
              </div>
            </div>
          )}
        </StepCard>

        {/* Step 3: Convex OAuth */}
        <StepCard
          step="3"
          title="Convex team login"
          complete={viewer.onboarding.hasConvexToken}
        >
          {viewer.convex ? (
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                Connected with Convex OAuth.
              </p>
              <p>
                Team:{" "}
                <span className="font-medium text-white">
                  {viewer.convex.teamId}
                </span>
              </p>
              <p>
                Token preview:{" "}
                <span className="font-medium text-white">
                  {viewer.convex.tokenPreview}
                </span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Sign in with Convex to authorize access to a team. We will store the
                resulting team-scoped application token for app creation workflows.
              </p>
              <button
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={busy !== null}
                onClick={() => {
                  void (async () => {
                    setBusy("convex");
                    setError(null);
                    try {
                      const result = await signIn("convex", { redirectTo: "/" });
                      if (result.redirect) {
                        window.location.href = result.redirect.toString();
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not connect Convex");
                    } finally {
                      setBusy(null);
                    }
                  })();
                }}
              >
                {busy === "convex" ? "Redirecting..." : "Connect Convex"}
              </button>
            </div>
          )}
        </StepCard>
      </section>

      <aside className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Status</h2>
          <StatusRow
            label="GitHub"
            value={
              viewer.onboarding.hasGitHubConnection ? "Connected" : "Missing"
            }
          />
          <StatusRow
            label="Vercel"
            value={
              viewer.onboarding.hasVercelConnection ? "Connected" : "Missing"
            }
          />
          <StatusRow
            label="Convex"
            value={viewer.onboarding.hasConvexToken ? "Connected" : "Missing"}
          />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <h3 className="text-lg font-medium text-white">Apps access</h3>
          <p className="mt-2 text-sm text-slate-300">
            {viewer.onboarding.canAccessApps
              ? "Everything is connected. You can create apps now."
              : "Finish all three steps before /apps is unlocked."}
          </p>
          <Link
            href="/apps"
            className={`mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-medium transition ${
              viewer.onboarding.canAccessApps
                ? "bg-white text-slate-950 hover:bg-slate-200"
                : "pointer-events-none bg-slate-800 text-slate-500"
            }`}
          >
            Go to /apps
          </Link>
        </div>
      </aside>
    </div>
  );
}

function StepCard({
  step,
  title,
  complete,
  children,
}: {
  step: string;
  title: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Step {step}
          </p>
          <h3 className="mt-1 text-lg font-medium text-white">{title}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            complete
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {complete ? "Complete" : "Required"}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-rose-500/30 bg-rose-500/10 text-rose-200"
      }`}
    >
      {children}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
