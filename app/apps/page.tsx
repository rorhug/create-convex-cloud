"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { FunctionReturnType } from "convex/server";

export default function AppsPage() {
  const viewer = useQuery(api.client.viewer.getViewer);

  if (viewer === undefined) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm text-slate-400">Loading apps...</p>
        </div>
      </main>
    );
  }

  if (!viewer.onboarding.canAccessApps) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Apps locked
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Finish onboarding first
          </h1>
          <p className="mt-3 text-sm text-slate-300">
            Connect GitHub, Vercel, and Convex before creating apps.
          </p>
          <Link
            href="/setup"
            className="mt-6 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
          >
            Back to setup
          </Link>
        </div>
      </main>
    );
  }

  return <AppsManager />;
}

const STATUS_COLORS: Record<string, string> = {
  creating: "bg-blue-500/15 text-blue-300",
  ready: "bg-emerald-500/15 text-emerald-300",
  deleting: "bg-amber-500/15 text-amber-300",
  error: "bg-rose-500/15 text-rose-300",
};

const STEP_LABELS: Record<string, string> = {
  github: "GitHub repo",
  convex: "Convex project",
  vercel: "Vercel deployment",
};

/** Joins with commas and a final "and", e.g. "a, b and c" (matches natural lists). */
function joinCommaAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function deleteConfirmationSureLabel(
  deleteGithub: boolean,
  deleteConvex: boolean,
  deleteVercel: boolean,
): string {
  const deleteParts: string[] = [];
  if (deleteGithub) deleteParts.push("the repo on GitHub");
  if (deleteConvex) deleteParts.push("the Convex project");
  if (deleteVercel) deleteParts.push("the Vercel project");

  const leaveParts: string[] = [];
  if (!deleteGithub) leaveParts.push("the GitHub repo");
  if (!deleteConvex) leaveParts.push("the Convex project");
  if (!deleteVercel) leaveParts.push("the Vercel project");

  const toRemove = [...deleteParts, "metadata from this product"];
  let main = `I am sure I want to delete ${joinCommaAnd(toRemove)}`;

  if (leaveParts.length > 0) {
    main += `, but leave ${joinCommaAnd(leaveParts)} intact`;
  }

  return main;
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "done":
      return <span className="text-emerald-400">&#10003;</span>;
    case "running":
      return <span className="text-blue-400 animate-pulse">&#9679;</span>;
    case "error":
      return <span className="text-rose-400">&#10007;</span>;
    default:
      return <span className="text-slate-600">&#9675;</span>;
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
      className="mt-1 inline-block text-xs text-blue-400 hover:text-blue-300 hover:underline"
    >
      {url}
    </a>
  );
}

function DashboardLinks({ appId }: { appId: Id<"apps"> }) {
  const links = useQuery(api.client.apps.getAppDashboardLinks, { appId });
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  if (!links) return null;
  const items: Array<{ label: string; href: string }> = [];
  if (links.github) items.push({ label: "GitHub", href: links.github });
  if (links.vercel) items.push({ label: "Vercel", href: links.vercel });
  if (links.convex) items.push({ label: "Convex", href: links.convex });
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-slate-500">
      <p className="min-w-0">
        {items.map((item, i) => (
          <span key={item.label}>
            {i > 0 ? <span className="mx-1.5 text-slate-600">·</span> : null}
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setHoveredHref(item.href)}
              onMouseLeave={() => setHoveredHref((current) => (current === item.href ? null : current))}
              onFocus={() => setHoveredHref(item.href)}
              onBlur={() => setHoveredHref((current) => (current === item.href ? null : current))}
              className="font-medium text-slate-400 hover:text-slate-200 hover:underline"
            >
              {item.label}
            </a>
          </span>
        ))}
      </p>
      <span className="min-w-0 truncate text-right text-slate-600">
        {hoveredHref ?? ""}
      </span>
    </div>
  );
}

function StepProgress({ appId }: { appId: Id<"apps"> }) {
  const steps = useQuery(api.client.apps.getAppSteps, { appId });

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {steps.map((s: FunctionReturnType<typeof api.client.apps.getAppSteps>[number]) => (
        <div key={s.step} className="flex items-start gap-2 text-xs">
          <StepIcon status={s.status} />
          <span
            className={
              s.status === "error"
                ? "text-rose-300"
                : s.status === "done"
                  ? "text-slate-400"
                  : s.status === "running"
                    ? "text-blue-300"
                    : "text-slate-600"
            }
          >
            {STEP_LABELS[s.step] ?? s.step}
            {s.message ? ` — ${s.message}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function AppsManager() {
  const viewer = useQuery(api.client.viewer.getViewer);
  const apps = useQuery(api.client.apps.listApps);
  const createApp = useMutation(api.client.apps.createApp);
  const deleteApp = useAction(api.client.apps.deleteApp);
  const vercelTeams = viewer?.vercel?.teams ?? [];
  const [vercelTeamId, setVercelTeamId] = useState("");
  const [githubRepoVisibility, setGithubRepoVisibility] = useState<
    "" | "public" | "private"
  >("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"apps">;
    name: string;
  } | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleteGithub, setDeleteGithub] = useState(true);
  const [deleteConvex, setDeleteConvex] = useState(true);
  const [deleteVercel, setDeleteVercel] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openDeleteDialog(id: Id<"apps">, appName: string) {
    setDeleteTarget({ id, name: appName });
    setConfirmChecked(false);
    setDeleteGithub(true);
    setDeleteConvex(true);
    setDeleteVercel(true);
    setIsDeleting(false);
    setDeleteError(null);
  }

  function closeDeleteDialog() {
    if (!isDeleting) {
      setDeleteTarget(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteApp({
        id: deleteTarget.id,
        deleteGithubRepo: deleteGithub,
        deleteConvexProject: deleteConvex,
        deleteVercelProject: deleteVercel,
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete the app",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreate() {
    if (githubRepoVisibility !== "public" && githubRepoVisibility !== "private") {
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      await createApp({
        name,
        vercelTeamId: vercelTeamId.trim(),
        githubRepoVisibility,
      });
      setName("");
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
    <main className="min-h-screen bg-slate-950 p-8 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Apps
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Create an app
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Creates a GitHub repo, Convex project, and Vercel deployment.
            </p>
          </div>
          <Link
            href="/setup"
            className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Back to setup
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <div className="space-y-4">
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
                  onChange={(event) => {
                    setVercelTeamId(event.target.value);
                    setError(null);
                  }}
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
                  const v = event.target.value;
                  setGithubRepoVisibility(
                    v === "public" || v === "private" ? v : "",
                  );
                  setError(null);
                }}
                className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-slate-500"
              >
                <option value="">Public or private…</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <p className="text-xs text-slate-500">
                New repos are created under your GitHub account with this
                visibility.
              </p>
            </div>
            <label className="block text-sm font-medium text-slate-200">
              App name
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                placeholder="my-demo-app"
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
              />
              <button
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={
                  isCreating ||
                  name.trim().length === 0 ||
                  vercelTeams.length === 0 ||
                  vercelTeamId === "" ||
                  (githubRepoVisibility !== "public" &&
                    githubRepoVisibility !== "private")
                }
                onClick={() => {
                  void handleCreate();
                }}
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

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-xl font-semibold text-white">Your apps</h2>
          <div className="mt-4 space-y-3">
            {apps === undefined && (
              <p className="text-sm text-slate-400">Loading existing apps...</p>
            )}
            {apps?.length === 0 && (
              <p className="text-sm text-slate-400">
                No apps yet. Create your first one above.
              </p>
            )}
            {apps?.map((app) => (
              <div
                key={app._id}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-white">{app.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status] ?? "bg-slate-500/15 text-slate-300"}`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <button
                    disabled={app.status === "deleting"}
                    onClick={() => openDeleteDialog(app._id, app.name)}
                    className="rounded-xl px-3 py-1.5 text-sm text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
                <DeploymentUrl appId={app._id} />
                <DashboardLinks appId={app._id} />
                {app.status !== "ready" ? <StepProgress appId={app._id} /> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent className="bg-slate-900 text-slate-50 border-slate-700">
          <DialogHeader>
            <DialogTitle>
              Delete &ldquo;{deleteTarget?.name}&rdquo;
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete the app and its resources.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Resources to delete
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={deleteGithub}
                  onCheckedChange={(checked) =>
                    setDeleteGithub(checked === true)
                  }
                />
                <span className="text-sm text-slate-300">Git repo</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={deleteConvex}
                  onCheckedChange={(checked) =>
                    setDeleteConvex(checked === true)
                  }
                />
                <span className="text-sm text-slate-300">Convex project</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={deleteVercel}
                  onCheckedChange={(checked) =>
                    setDeleteVercel(checked === true)
                  }
                />
                <span className="text-sm text-slate-300">Vercel project</span>
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                className="mt-0.5"
                checked={confirmChecked}
                onCheckedChange={(checked) =>
                  setConfirmChecked(checked === true)
                }
              />
              <span className="text-sm font-medium leading-snug text-slate-200">
                {deleteConfirmationSureLabel(
                  deleteGithub,
                  deleteConvex,
                  deleteVercel,
                )}
              </span>
            </label>

            {deleteError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {deleteError}
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-900 border-t border-slate-700 pt-4">
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={isDeleting}
              className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirmChecked || isDeleting}
              onClick={() => {
                void handleDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Confirm delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
