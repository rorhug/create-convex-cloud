"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ImportPage() {
  const viewer = useQuery(api.client.viewer.getViewer);
  const existingProjects = useQuery(api.client.imports.getExistingProjects);
  const scheduleExistingProjectSearch = useMutation(api.client.imports.scheduleExistingProjectSearch);
  const importExistingProject = useMutation(api.client.imports.importExistingProject);

  const [actionError, setActionError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [importingProjectId, setImportingProjectId] = useState<Id<"existingProjects"> | null>(null);

  if (viewer === undefined || existingProjects === undefined) {
    return (
      <div className="border border-border bg-card p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading import tools....
        </div>
      </div>
    );
  }

  if (!viewer.onboarding.canAccessApps) {
    return (
      <section className="border border-border bg-card p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Setup required</p>
        <h1 className="mt-2 text-3xl font-semibold">Finish setup before importing apps</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Import needs the same GitHub, Vercel, and Convex connections as app creation.
        </p>
        {viewer.onboarding.requiredActions.length > 0 ? (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {viewer.onboarding.requiredActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        ) : null}
        <Button asChild className="mt-6">
          <Link href="/setup">Go to setup</Link>
        </Button>
      </section>
    );
  }

  const isSearching = existingProjects.status === "searching";

  return (
    <div className="space-y-6">
      <section className="border border-border bg-card p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Import</p>
        <h1 className="mt-2 text-3xl font-semibold">Import linked projects</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Search Vercel first, then keep only the projects that are already wired to a GitHub repo and a resolvable
          Convex project.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            disabled={isScheduling || isSearching}
            onClick={async () => {
              setActionError(null);
              setIsScheduling(true);
              try {
                await scheduleExistingProjectSearch({});
              } catch (error) {
                setActionError(error instanceof Error ? error.message : "Could not start the search.");
              } finally {
                setIsScheduling(false);
              }
            }}
          >
            {isSearching || isScheduling ? "Searching..." : "Search for existing projects"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Importable projects are listed first. Blocked rows stay visible below at lower opacity.
          </p>
        </div>
        {existingProjects.message ? (
          <div
            className={`mt-4 border px-4 py-3 text-sm ${
              existingProjects.status === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {existingProjects.message}
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-4 border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}
      </section>

      <section className="border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Existing projects</h2>
          {existingProjects.updatedAt ? (
            <span className="text-xs text-muted-foreground">
              Last checked {new Date(existingProjects.updatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {isSearching && existingProjects.projects.length === 0 ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Searching Vercel projects...
          </div>
        ) : existingProjects.projects.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {existingProjects.status === "idle"
              ? "Run a search to discover existing Vercel projects."
              : "No projects to show yet."}
          </p>
        ) : (
          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vercel</TableHead>
                  <TableHead>GitHub</TableHead>
                  <TableHead>Convex</TableHead>
                  <TableHead className="w-[260px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingProjects.projects.map((project) => (
                  <TableRow key={project._id} className={!project.importable ? "opacity-50" : undefined}>
                    <TableCell className="align-top whitespace-normal">
                      <div className="space-y-1">
                        <a
                          href={project.vercelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:underline"
                        >
                          {project.vercelProjectName}
                        </a>
                        <p className="text-xs text-muted-foreground">{project.vercelTeamSlug}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {project.githubRepoFullName && project.githubRepoUrl ? (
                        <a
                          href={project.githubRepoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:underline"
                        >
                          {project.githubRepoFullName}
                        </a>
                      ) : project.githubRepoFullName ? (
                        <span className="text-sm text-muted-foreground">{project.githubRepoFullName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {project.convexProjectSlug && project.convexUrl ? (
                        <a
                          href={project.convexUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:underline"
                        >
                          {project.convexProjectSlug}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not resolved</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {project.importable ? (
                        <Button
                          size="sm"
                          disabled={importingProjectId === project._id}
                          onClick={async () => {
                            setActionError(null);
                            setImportingProjectId(project._id);
                            try {
                              await importExistingProject({ existingProjectId: project._id });
                            } catch (error) {
                              setActionError(error instanceof Error ? error.message : "Could not import the project.");
                            } finally {
                              setImportingProjectId(null);
                            }
                          }}
                        >
                          {importingProjectId === project._id ? "Importing..." : "Import"}
                        </Button>
                      ) : (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {project.reasons.map((reason) => (
                            <p key={reason}>{reason}</p>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
