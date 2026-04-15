"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import {
  AppCreationSection,
  type AppsGithubInstallation,
  type AppsVercelTeam,
} from "./components";
import { DeleteAppDialog } from "./delete-app-dialog";

export default function AppsPage() {
  const viewer = useQuery(api.client.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <div className="mx-auto max-w-3xl border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading apps...
        </div>
      </div>
    );
  }

  if (!viewer.onboarding.canAccessApps) {
    return (
      <div className="mx-auto max-w-3xl border border-border bg-card p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Apps locked
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Finish onboarding first</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Connect GitHub, Vercel, and Convex before creating apps.
        </p>
        <Button asChild className="mt-6">
          <Link href="/setup">Back to setup</Link>
        </Button>
      </div>
    );
  }

  return <AppsManager />;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  creating: "secondary",
  ready: "default",
  deleting: "outline",
  error: "destructive",
};

const STEP_LABELS: Record<string, string> = {
  github: "GitHub repo",
  convex: "Convex project",
  vercel: "Vercel deployment",
};

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "done":
      return <span className="text-primary">&#10003;</span>;
    case "running":
      return <Spinner className="size-3" />;
    case "error":
      return <span className="text-destructive">&#10007;</span>;
    default:
      return <span className="text-muted-foreground/50">&#9675;</span>;
  }
}

function DeploymentUrl({ appId }: { appId: Id<"apps"> }) {
  const url = useQuery(api.client.apps.getAppDeploymentUrl, { appId });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block text-xs text-primary hover:underline"
    >
      {url}
    </a>
  );
}

function DashboardLinks({ appId }: { appId: Id<"apps"> }) {
  const links = useQuery(api.client.apps.getAppDashboardLinks, { appId });
  if (!links) return null;
  const items: Array<{ label: string; href: string }> = [];
  if (links.github) items.push({ label: "GitHub", href: links.github });
  if (links.vercel) items.push({ label: "Vercel", href: links.vercel });
  if (links.convex) items.push({ label: "Convex", href: links.convex });
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 ? <span className="mx-1 text-border">·</span> : null}
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground hover:underline"
          >
            {item.label}
          </a>
        </span>
      ))}
    </div>
  );
}

function StepProgress({ appId }: { appId: Id<"apps"> }) {
  const steps = useQuery(api.client.apps.getAppSteps, { appId });

  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-1">
      {steps.map(
        (s: FunctionReturnType<typeof api.client.apps.getAppSteps>[number]) => (
          <div key={s.step} className="flex items-start gap-2 text-xs">
            <StepIcon status={s.status} />
            <span
              className={
                s.status === "error"
                  ? "text-destructive"
                  : s.status === "done"
                    ? "text-muted-foreground"
                    : s.status === "running"
                      ? "text-foreground"
                      : "text-muted-foreground/50"
              }
            >
              {STEP_LABELS[s.step] ?? s.step}
              {s.message ? ` — ${s.message}` : ""}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function AppsManager() {
  const viewer = useQuery(api.client.viewer.getViewer);
  const apps = useQuery(api.client.apps.listApps);
  const createApp = useMutation(api.client.apps.createApp);
  const githubInstallations: AppsGithubInstallation[] =
    viewer?.github.installations ?? [];
  const vercelTeams: AppsVercelTeam[] = viewer?.vercel?.teams ?? [];
  const [githubInstallationId, setGithubInstallationId] = useState("");
  const [vercelTeamId, setVercelTeamId] = useState("");
  const [githubRepoVisibility, setGithubRepoVisibility] = useState<
    "" | "public" | "private"
  >("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"apps">;
    name: string;
  } | null>(null);

  async function handleCreate() {
    if (
      githubRepoVisibility !== "public" &&
      githubRepoVisibility !== "private"
    ) {
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
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create the app",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <div className="w-full space-y-6">
        <section className="border border-border bg-card p-6">
          <div>
            <h1 className="text-3xl font-semibold">Create an app</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Creates a GitHub repo, Convex project, and Vercel deployment.
            </p>
          </div>
        </section>

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

        <section className="border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Your apps</h2>
          <div className="mt-4">
            {apps === undefined && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Loading existing apps...
              </div>
            )}
            {apps?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No apps yet. Create your first one above.
              </p>
            )}
            <ItemGroup>
              {apps?.map((app) => (
                <Item key={app._id} variant="outline">
                  <ItemHeader>
                    <ItemContent>
                      <ItemTitle>
                        {app.status !== "ready" && <Spinner className="size-3.5" />}
                        {app.name}
                        <Badge variant={STATUS_VARIANT[app.status] ?? "secondary"}>
                          {app.status}
                        </Badge>
                      </ItemTitle>
                      <ItemDescription>
                        <DeploymentUrl appId={app._id} />
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={app.status === "deleting"}
                        onClick={() =>
                          setDeleteTarget({ id: app._id, name: app.name })
                        }
                      >
                        Delete
                      </Button>
                    </ItemActions>
                  </ItemHeader>
                  <ItemFooter>
                    <DashboardLinks appId={app._id} />
                  </ItemFooter>
                  {app.status !== "ready" ? (
                    <div className="w-full pt-1">
                      <StepProgress appId={app._id} />
                    </div>
                  ) : null}
                </Item>
              ))}
            </ItemGroup>
          </div>
        </section>
      </div>

      <DeleteAppDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
