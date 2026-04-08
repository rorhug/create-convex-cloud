"use client";

import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import { Banner } from "./components/banner";
import { ConvexSetupStep } from "./components/convex-setup-step";
import { GitHubSetupStep } from "./components/github-setup-step";
import { StatusSidebar } from "./components/status-sidebar";
import { VercelSetupStep } from "./components/vercel-setup-step";
import type { SetupBusyState, SetupViewerState, SetupVercelTeam } from "./components/types";

export function Content({ viewer }: { viewer: SetupViewerState }) {
  const { signIn } = useAuthActions();
  const refreshGithubInstallations = useAction(
    api.client.providers.github.clientActions.refreshGithubInstallations,
  );
  const verifyVercelToken = useAction(
    api.client.providers.vercel.clientActions.verifyVercelToken,
  );
  const saveVercelToken = useAction(
    api.client.providers.vercel.clientActions.saveVercelToken,
  );

  const [vercelToken, setVercelToken] = useState("");
  const [vercelTeams, setVercelTeams] = useState<SetupVercelTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SetupBusyState>(null);
  const hasHandledRefreshGithubInstallationsParam = useRef(false);

  useEffect(() => {
    if (hasHandledRefreshGithubInstallationsParam.current) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get("refresh-github-installations") !== "1") {
      return;
    }

    hasHandledRefreshGithubInstallationsParam.current = true;
    url.searchParams.delete("refresh-github-installations");
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);

    void (async () => {
      setBusy("github-refresh");
      setError(null);
      try {
        await refreshGithubInstallations({});
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Could not refresh GitHub installations",
        );
      } finally {
        setBusy(null);
      }
    })();
  }, [refreshGithubInstallations]);

  async function handleRefreshGithubInstallations() {
    setBusy("github-refresh");
    setError(null);
    try {
      await refreshGithubInstallations({});
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh GitHub installations",
      );
    } finally {
      setBusy(null);
    }
  }

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

        <GitHubSetupStep
          complete={viewer.onboarding.hasGitHubConnection}
          installations={viewer.github.installations}
          installUrl={viewer.github.installUrl}
          isRefreshing={busy === "github-refresh"}
          disabled={busy !== null}
          onRefresh={() => {
            void handleRefreshGithubInstallations();
          }}
        />

        <VercelSetupStep
          complete={viewer.onboarding.hasVercelConnection}
          vercel={viewer.vercel}
          vercelToken={vercelToken}
          vercelTeams={vercelTeams}
          busy={busy}
          onTokenChange={(value) => {
            setVercelToken(value);
            setVercelTeams(null);
            setError(null);
          }}
          onVerify={() => {
            void handleVerifyVercelToken();
          }}
          onSave={() => {
            void handleSaveVercelToken();
          }}
        />

        <ConvexSetupStep
          complete={viewer.onboarding.hasConvexToken}
          convex={viewer.convex}
          busy={busy}
          onLink={() => {
            void (async () => {
              setBusy("convex");
              setError(null);
              try {
                const result = await signIn("convex", { redirectTo: "/" });
                if (result.redirect) {
                  window.location.href = result.redirect.toString();
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not link Convex");
              } finally {
                setBusy(null);
              }
            })();
          }}
        />
      </section>

      <StatusSidebar
        canAccessApps={viewer.onboarding.canAccessApps}
        hasGitHubConnection={viewer.onboarding.hasGitHubConnection}
        hasVercelConnection={viewer.onboarding.hasVercelConnection}
        hasConvexToken={viewer.onboarding.hasConvexToken}
      />
    </div>
  );
}
