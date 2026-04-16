"use client";

import Link from "next/link";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Banner } from "./components/banner";
import { ConvexSetupStep } from "./components/convex-setup-step";
import { GitHubSetupStep } from "./components/github-setup-step";
import type { SetupBusyState, SetupVercelTeam, SetupViewerState } from "./components/types";
import { VercelSetupStep } from "./components/vercel-setup-step";
import { ArrowRightIcon } from "@phosphor-icons/react";

export function Content({ viewer }: { viewer: SetupViewerState }) {
  const { signIn } = useAuthActions();
  const refreshGithubInstallations = useAction(api.client.providers.github.clientActions.refreshGithubInstallations);
  const verifyVercelToken = useAction(api.client.providers.vercel.clientActions.verifyVercelToken);
  const refreshVercelTeams = useAction(api.client.providers.vercel.clientActions.refreshVercelTeams);
  const saveVercelToken = useAction(api.client.providers.vercel.clientActions.saveVercelToken);
  const refreshConvexToken = useAction(api.client.providers.convex.clientActions.refreshConvexToken);

  const [vercelToken, setVercelToken] = useState("");
  const [vercelTeams, setVercelTeams] = useState<SetupVercelTeam[] | null>(null);
  const [showReplaceVercelToken, setShowReplaceVercelToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SetupBusyState>(null);
  const hasHandledRefreshGithubInstallationsParam = useRef(false);
  const isSetupComplete = viewer.onboarding.canAccessApps;

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
        setError(refreshError instanceof Error ? refreshError.message : "Could not refresh GitHub installations");
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
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh GitHub installations");
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
      setError(verifyError instanceof Error ? verifyError.message : "Could not verify the Vercel token");
    } finally {
      setBusy(null);
    }
  }

  async function handleRefreshVercelTeams() {
    setBusy("vercel-refresh");
    setError(null);
    try {
      await refreshVercelTeams({});
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh the saved Vercel token");
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
      setShowReplaceVercelToken(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the Vercel token");
    } finally {
      setBusy(null);
    }
  }

  async function handleRefreshConvexToken() {
    setBusy("convex-refresh");
    setError(null);
    try {
      await refreshConvexToken({});
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh the saved Convex token");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-6">
      {isSetupComplete ? (
        <Button asChild className="w-full">
          <Link href="/apps">
            Create an app <ArrowRightIcon />
          </Link>
        </Button>
      ) : null}

      {error && <Banner tone="error">{error}</Banner>}

      <GitHubSetupStep
        complete={viewer.onboarding.hasGitHubConnection && !viewer.github.needsAttention}
        installations={viewer.github.installations}
        installUrl={viewer.github.installUrl}
        issue={viewer.github.issue}
        isRefreshing={busy === "github-refresh"}
        disabled={busy !== null}
        onRefresh={() => {
          void handleRefreshGithubInstallations();
        }}
      />

      <VercelSetupStep
        complete={viewer.vercel?.isValid === true}
        vercel={viewer.vercel}
        vercelToken={vercelToken}
        vercelTeams={vercelTeams}
        showReplaceToken={showReplaceVercelToken}
        busy={busy}
        issue={viewer.vercel?.issue ?? null}
        onTokenChange={(value) => {
          setVercelToken(value);
          setVercelTeams(null);
          setError(null);
        }}
        onRefresh={() => {
          void handleRefreshVercelTeams();
        }}
        onVerify={() => {
          void handleVerifyVercelToken();
        }}
        onSave={() => {
          void handleSaveVercelToken();
        }}
        onToggleReplaceToken={() => {
          setShowReplaceVercelToken((value) => !value);
        }}
      />

      <ConvexSetupStep
        complete={viewer.convex?.isValid === true}
        convex={viewer.convex}
        busy={busy}
        issue={viewer.convex?.issue ?? null}
        onRefresh={() => {
          void handleRefreshConvexToken();
        }}
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

      {isSetupComplete ? (
        <Button asChild className="w-full">
          <Link href="/apps">
            Create an app <ArrowRightIcon />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}
