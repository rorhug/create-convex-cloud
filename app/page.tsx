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
              <code>/apps</code> to create apps in Convex.
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

function Content({
  viewer,
}: {
  viewer: {
    user: {
      name: string | null;
      email: string | null;
      image: string | null;
    };
    vercel: {
      name: string | null;
      email: string | null;
      username: string | null;
      avatarUrl: string | null;
    } | null;
    convex: {
      teamId: string;
      tokenPreview: string;
    } | null;
    onboarding: {
      hasGitHubConnection: boolean;
      hasVercelConnection: boolean;
      hasConvexTeamAccessToken: boolean;
      canAccessApps: boolean;
    };
  };
}) {
  const { signIn } = useAuthActions();
  const verifyConvexToken = useAction(api.viewer.verifyConvexTeamAccessToken);
  const saveConvexToken = useMutation(api.viewer.saveConvexTeamAccessToken);
  const [token, setToken] = useState("");
  const [verified, setVerified] = useState<{
    teamId: string;
    projectCount: number;
    verifiedToken: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"vercel" | "verify" | "save" | null>(null);

  async function handleVerifyToken() {
    setBusy("verify");
    setError(null);
    try {
      const trimmedToken = token.trim();
      const result = await verifyConvexToken({ token: trimmedToken });
      setVerified({
        teamId: result.teamId,
        projectCount: result.projectCount,
        verifiedToken: trimmedToken,
      });
    } catch (verifyError) {
      setVerified(null);
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Could not verify the Convex token",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveToken() {
    if (verified === null || verified.verifiedToken !== token.trim()) {
      setError("Verify the current token before saving it");
      return;
    }

    setBusy("save");
    setError(null);
    try {
      await saveConvexToken({
        token: verified.verifiedToken,
        teamId: verified.teamId,
      });
      setToken("");
      setVerified(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the Convex token",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleConnectVercel() {
    setBusy("vercel");
    setError(null);
    try {
      const result = await signIn("vercel", { redirectTo: "/" });
      if (result.redirect) {
        window.location.href = result.redirect.toString();
        return;
      }
      setBusy(null);
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Could not connect the Vercel account",
      );
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            Signed in as {viewer.user.email ?? viewer.user.name ?? "GitHub user"}
          </p>
          <h2 className="text-2xl font-semibold text-white">
            Onboarding checklist
          </h2>
        </div>

        {error && <Banner tone="error">{error}</Banner>}

        <StepCard
          step="1"
          title="GitHub login"
          complete={viewer.onboarding.hasGitHubConnection}
        >
          <p className="text-sm text-slate-300">
            GitHub is the only enabled sign-in method for this app.
          </p>
        </StepCard>

        <StepCard
          step="2"
          title="Connect your Vercel account"
          complete={viewer.onboarding.hasVercelConnection}
        >
          {viewer.vercel ? (
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                Connected as{" "}
                <span className="font-medium text-white">
                  {viewer.vercel.username ?? viewer.vercel.email ?? "Vercel user"}
                </span>
              </p>
              {viewer.vercel.name && <p>Name: {viewer.vercel.name}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                After GitHub login, connect Vercel so this account is linked to a
                Vercel user.
              </p>
              <button
                type="button"
                className="inline-flex rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
                disabled={busy !== null}
                onClick={() => {
                  void handleConnectVercel();
                }}
              >
                {busy === "vercel" ? "Redirecting to Vercel..." : "Connect Vercel"}
              </button>
            </div>
          )}
        </StepCard>

        <StepCard
          step="3"
          title="Save a Convex team access token"
          complete={viewer.onboarding.hasConvexTeamAccessToken}
        >
          {viewer.convex ? (
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                Saved for team <span className="font-medium text-white">{viewer.convex.teamId}</span>
              </p>
              <p>Stored token: {viewer.convex.tokenPreview}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Paste a Convex team access token. We verify it against the
                Management API before letting you save it.
              </p>
              <textarea
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  setVerified(null);
                  setError(null);
                }}
                rows={5}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
                placeholder="Paste Convex team access token"
              />
              {verified && (
                <Banner tone="success">
                  Token verified for team {verified.teamId}. Convex returned{" "}
                  {verified.projectCount} project
                  {verified.projectCount === 1 ? "" : "s"}.
                </Banner>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  disabled={busy !== null || token.trim().length === 0}
                  onClick={() => {
                    void handleVerifyToken();
                  }}
                >
                  {busy === "verify" ? "Verifying..." : "Verify token"}
                </button>
                <button
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                  disabled={
                    busy !== null ||
                    verified === null ||
                    verified.verifiedToken !== token.trim()
                  }
                  onClick={() => {
                    void handleSaveToken();
                  }}
                >
                  {busy === "save" ? "Saving..." : "Save token"}
                </button>
              </div>
            </div>
          )}
        </StepCard>
      </section>

      <aside className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Status</h2>
          <StatusRow
            label="GitHub"
            value={viewer.onboarding.hasGitHubConnection ? "Connected" : "Missing"}
          />
          <StatusRow
            label="Vercel"
            value={viewer.onboarding.hasVercelConnection ? "Connected" : "Missing"}
          />
          <StatusRow
            label="Convex team token"
            value={
              viewer.onboarding.hasConvexTeamAccessToken ? "Saved" : "Missing"
            }
          />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <h3 className="text-lg font-medium text-white">Apps access</h3>
          <p className="mt-2 text-sm text-slate-300">
            {viewer.onboarding.canAccessApps
              ? "Everything is connected. You can create apps now."
              : "Finish Vercel and Convex setup before /apps is unlocked."}
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
