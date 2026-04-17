"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AppCreationSection, type AppsGithubInstallation, type AppsVercelTeam } from "./components";
import { AppList } from "./app-card";
import { DeleteAppDialog } from "./delete-app-dialog";

export default function AppsPage() {
  const viewer = useQuery(api.client.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <div className="border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading apps...
        </div>
      </div>
    );
  }

  return <AppsManager />;
}

function AppsManager() {
  const viewer = useQuery(api.client.viewer.getViewer);
  const apps = useQuery(api.client.apps.listApps);
  const createApp = useMutation(api.client.apps.createApp);
  const githubInstallations: AppsGithubInstallation[] = viewer?.github.installations ?? [];
  const vercelTeams: AppsVercelTeam[] = viewer?.vercel?.teams ?? [];
  const canAccessApps = viewer?.onboarding.canAccessApps ?? false;
  const requiredActions = viewer?.onboarding.requiredActions ?? [];
  const [githubInstallationId, setGithubInstallationId] = useState("");
  const [vercelTeamId, setVercelTeamId] = useState("");
  const [githubRepoVisibility, setGithubRepoVisibility] = useState<"" | "public" | "private">("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"apps">;
    name: string;
  } | null>(null);

  async function handleCreate() {
    if (githubRepoVisibility !== "public" && githubRepoVisibility !== "private") {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await createApp({
        name,
        githubInstallationId,
        vercelTeamId: vercelTeamId.trim(),
        githubRepoVisibility,
      });
      setName("");
      setGithubInstallationId("");
      setGithubRepoVisibility("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the app");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <div className="w-full space-y-6">
        {canAccessApps ? (
          <AppCreationSection
            error={error}
            githubInstallationId={githubInstallationId}
            githubInstallations={githubInstallations}
            githubRepoVisibility={githubRepoVisibility}
            isCreating={isCreating}
            name={name}
            onGithubInstallationChange={(value) => {
              setGithubInstallationId(value);
              setError(null);
            }}
            onGithubRepoVisibilityChange={(value) => {
              setGithubRepoVisibility(value);
              setError(null);
            }}
            onNameChange={(value) => {
              setName(value);
              setError(null);
            }}
            onSubmit={() => {
              void handleCreate();
            }}
            onVercelTeamChange={(value) => {
              setVercelTeamId(value);
              setError(null);
            }}
            vercelTeamId={vercelTeamId}
            vercelTeams={vercelTeams}
          />
        ) : (
          <section className="border border-border bg-card p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Setup required</p>
            <h1 className="mt-2 text-3xl font-semibold">Finish setup before creating more apps</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Existing apps remain visible here, but setup needs attention before new app creation can continue.
            </p>
            {requiredActions.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {requiredActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            ) : null}
            <Button asChild className="mt-6">
              <Link href="/setup">Go to setup</Link>
            </Button>
          </section>
        )}

        <AppList apps={apps} onDelete={(app) => setDeleteTarget(app)} />
      </div>

      <DeleteAppDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </>
  );
}
