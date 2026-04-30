"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  CreateAppForm,
  type AppsGithubInstallation,
  type AppsVercelTeam,
  type CreateAppFormDefaults,
} from "./create-app-form";
import { AppList } from "./app-card";
import { DeleteAppDialog } from "./delete-app-dialog";

const GITHUB_PAGES_VALUE = "github-pages";

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
  const lastAppSelections = useQuery(api.client.apps.getLastAppSelections);
  const createApp = useMutation(api.client.apps.createApp);
  const githubInstallations: AppsGithubInstallation[] = viewer?.github.installations ?? [];
  const vercelTeams: AppsVercelTeam[] = viewer?.vercel?.teams ?? [];
  const isGithubPagesConfirmed = viewer?.githubPages != null;
  const canAccessApps = viewer?.onboarding.canAccessApps ?? false;
  const requiredActions = viewer?.onboarding.requiredActions ?? [];

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"apps">;
    name: string;
  } | null>(null);

  return (
    <>
      <div className="w-full space-y-6">
        {canAccessApps ? (
          lastAppSelections === undefined ? (
            <div className="border border-border bg-card p-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Loading form...
              </div>
            </div>
          ) : (
            <CreateAppForm
              defaultValues={buildDefaultValues(
                lastAppSelections,
                githubInstallations,
                vercelTeams,
                isGithubPagesConfirmed,
              )}
              githubInstallations={githubInstallations}
              vercelTeams={vercelTeams}
              isGithubPagesConfirmed={isGithubPagesConfirmed}
              onSubmit={async (values) => {
                await createApp({
                  name: values.name,
                  githubInstallationId: values.githubInstallationId,
                  deploymentTarget: values.deploymentTarget,
                  githubRepoVisibility: values.githubRepoVisibility,
                });
              }}
            />
          )
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

function buildDefaultValues(
  lastAppSelections:
    | {
        deploymentTarget: "vercel" | "github-pages";
        githubInstallationId: string;
        vercelTeamId: string | null;
        githubRepoVisibility: "public" | "private";
      }
    | null,
  githubInstallations: AppsGithubInstallation[],
  vercelTeams: AppsVercelTeam[],
  isGithubPagesConfirmed: boolean,
): CreateAppFormDefaults {
  // Default deployment target: prefer the last app's choice if still available;
  // fall back to GitHub Pages when the user has confirmed it on /setup;
  // otherwise leave blank for the user to pick.
  let deploymentTargetId = "";
  if (lastAppSelections?.deploymentTarget === "github-pages") {
    deploymentTargetId = GITHUB_PAGES_VALUE;
  } else if (
    lastAppSelections?.deploymentTarget === "vercel" &&
    lastAppSelections.vercelTeamId &&
    vercelTeams.some((t) => t.id === lastAppSelections.vercelTeamId)
  ) {
    deploymentTargetId = lastAppSelections.vercelTeamId;
  } else if (isGithubPagesConfirmed) {
    deploymentTargetId = GITHUB_PAGES_VALUE;
  }

  if (!lastAppSelections) {
    return {
      name: "",
      githubInstallationId: "",
      deploymentTargetId,
      githubRepoVisibility: "",
    };
  }

  // Only carry over the last GitHub installation if it still exists for this user.
  const githubInstallationId = githubInstallations.some(
    (i) => i.id === lastAppSelections.githubInstallationId,
  )
    ? lastAppSelections.githubInstallationId
    : "";

  return {
    name: "",
    githubInstallationId,
    deploymentTargetId,
    githubRepoVisibility: lastAppSelections.githubRepoVisibility,
  };
}
