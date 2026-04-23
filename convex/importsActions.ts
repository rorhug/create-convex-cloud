"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { normalizeGithubRepoFullName } from "./lib/imports";
import { resolveConvexProjectFromDeployKey } from "./lib/providers/convex/platform";
import { fetchGithubRepositoriesForUserInstallation } from "./lib/providers/github/platform";
import {
  type VercelEnvironmentVariable,
  fetchLatestProductionDeploymentUrlForProject,
  fetchVercelProjectEnvironmentVariableDecryptedValue,
  fetchVercelProjectEnvironmentVariables,
  fetchVercelProjectsForTeam,
} from "./lib/providers/vercel/platform";

type ExistingProjectInput = {
  vercelProjectId: string;
  vercelProjectName: string;
  vercelTeamId: string;
  vercelTeamSlug: string;
  deploymentUrl?: string;
  gitProvider?: string;
  githubRepoFullName?: string;
  githubRepoUrl?: string;
  githubRepoPrivate?: boolean;
  githubInstallationId?: string;
  prodDeployKey?: string;
  previewDeployKey?: string;
  convexProjectId?: string;
  convexTeamId?: string;
  convexTeamSlug?: string;
  convexProjectSlug?: string;
  convexProdDeploymentName?: string;
};

type GithubRepoLookupEntry = {
  installationId: string;
  url: string;
  private: boolean;
};

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function normalizeVercelTargets(target?: string[] | string): string[] {
  if (Array.isArray(target)) {
    return target;
  }
  if (typeof target === "string" && target.length > 0) {
    return [target];
  }
  return [];
}

function getVercelEnv(
  envs: VercelEnvironmentVariable[],
  key: string,
  target: "production" | "preview",
): VercelEnvironmentVariable | undefined {
  return envs.find(
    (env) => env.key === key && normalizeVercelTargets(env.target).includes(target),
  );
}

async function getDecryptedVercelEnvValue(
  token: string,
  projectId: string,
  teamId: string,
  env: VercelEnvironmentVariable | undefined,
  ctx: Parameters<typeof fetchVercelProjectEnvironmentVariableDecryptedValue>[4],
): Promise<string | undefined> {
  if (!env?.id) {
    return undefined;
  }
  const decryptedEnv = await fetchVercelProjectEnvironmentVariableDecryptedValue(
    token,
    projectId,
    env.id,
    teamId,
    ctx,
  );
  return typeof decryptedEnv.value === "string" && decryptedEnv.value.trim().length > 0
    ? decryptedEnv.value
    : undefined;
}

async function buildGithubRepoLookup(
  accessToken: string,
  installations: Array<{ id: string }>,
  ctx: Parameters<typeof fetchGithubRepositoriesForUserInstallation>[2],
) {
  const lookup = new Map<string, GithubRepoLookupEntry>();

  for (const installation of installations) {
    const repositories = await fetchGithubRepositoriesForUserInstallation(
      accessToken,
      installation.id,
      ctx,
    );
    for (const repository of repositories) {
      const key = normalizeGithubRepoFullName(repository.fullName);
      if (lookup.has(key)) {
        continue;
      }
      lookup.set(key, {
        installationId: installation.id,
        url: repository.htmlUrl,
        private: repository.private,
      });
    }
  }

  return lookup;
}

export const searchExistingProjects = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.importsInternal.setExistingProjectSearchState, {
      userId: args.userId,
      status: "searching",
      message: "Searching Vercel projects...",
    });

    try {
      const vercelToken = await ctx.runQuery(internal.lib.providers.vercel.data.getVercelTokenForUser, {
        userId: args.userId,
      });
      if (!vercelToken) {
        throw new Error("Connect Vercel on the setup page before importing apps.");
      }
      if (vercelToken.tokenStatus !== "valid") {
        throw new Error("The saved Vercel token needs attention on the setup page.");
      }

      const githubConnection = await ctx.runQuery(internal.lib.providers.github.data.getGithubConnection, {
        userId: args.userId,
      });
      if (!githubConnection || githubConnection.githubTokenStatus !== "valid") {
        throw new Error("Reconnect GitHub on the setup page before importing apps.");
      }
      if (githubConnection.githubInstallations.length === 0) {
        throw new Error("Install the GitHub App on an account or org before importing apps.");
      }

      const { accessToken } = await ctx.runAction(
        internal.workflows.githubAccessTokenAction.ensureFreshGithubAccessToken,
        { userId: args.userId },
      );
      const githubRepos = await buildGithubRepoLookup(
        accessToken,
        githubConnection.githubInstallations,
        ctx,
      );

      const convexToken = await ctx.runQuery(internal.lib.providers.convex.data.getConvexTokenForUser, {
        userId: args.userId,
      });
      if (!convexToken) {
        throw new Error("Connect Convex on the setup page before importing apps.");
      }
      if (convexToken.tokenStatus !== "valid") {
        throw new Error("The saved Convex token needs attention on the setup page.");
      }

      const rows: ExistingProjectInput[] = [];

      for (const team of vercelToken.teams) {
        const projects = await fetchVercelProjectsForTeam(vercelToken.token, team.id, ctx);
        for (const project of projects) {
          const row: ExistingProjectInput = {
            vercelProjectId: project.id,
            vercelProjectName: project.name,
            vercelTeamId: team.id,
            vercelTeamSlug: team.slug,
            gitProvider: project.link?.type,
          };

          try {
            row.deploymentUrl = await fetchLatestProductionDeploymentUrlForProject(
              vercelToken.token,
              project.id,
              team.id,
              ctx,
            );
          } catch (error) {
            console.error("[searchExistingProjects] Failed to load latest Vercel deployment URL", {
              vercelProjectId: project.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }

          if (
            project.link?.type === "github" &&
            typeof project.link.org === "string" &&
            typeof project.link.repo === "string"
          ) {
            row.githubRepoFullName = `${project.link.org}/${project.link.repo}`;
            const githubRepo = githubRepos.get(normalizeGithubRepoFullName(row.githubRepoFullName));
            if (githubRepo) {
              row.githubInstallationId = githubRepo.installationId;
              row.githubRepoUrl = githubRepo.url;
              row.githubRepoPrivate = githubRepo.private;
            }
          }

          try {
            const envs = await fetchVercelProjectEnvironmentVariables(
              vercelToken.token,
              project.id,
              team.id,
              ctx,
            );
            row.prodDeployKey = await getDecryptedVercelEnvValue(
              vercelToken.token,
              project.id,
              team.id,
              getVercelEnv(envs, "CONVEX_DEPLOY_KEY", "production"),
              ctx,
            );
            row.previewDeployKey = await getDecryptedVercelEnvValue(
              vercelToken.token,
              project.id,
              team.id,
              getVercelEnv(envs, "CONVEX_DEPLOY_KEY", "preview"),
              ctx,
            );

            if (row.prodDeployKey) {
              try {
                const resolvedConvexProject = await resolveConvexProjectFromDeployKey(
                  convexToken.token,
                  row.prodDeployKey,
                  ctx,
                );
                row.convexProjectId = resolvedConvexProject.projectId;
                row.convexTeamId = convexToken.teamId;
                row.convexTeamSlug = resolvedConvexProject.teamSlug;
                row.convexProjectSlug = resolvedConvexProject.projectSlug;
                row.convexProdDeploymentName = resolvedConvexProject.prodDeploymentName;
              } catch (error) {
                console.error("[searchExistingProjects] Failed to resolve Convex project", {
                  vercelProjectId: project.id,
                  error: error instanceof Error ? error.message : "Unknown error",
                });
              }
            }
          } catch (error) {
            console.error("[searchExistingProjects] Failed to inspect Vercel project env vars", {
              vercelProjectId: project.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }

          rows.push(stripUndefinedFields(row));
        }
      }

      await ctx.runMutation(internal.importsInternal.replaceExistingProjectsForUser, {
        userId: args.userId,
        rows,
      });
      await ctx.runMutation(internal.importsInternal.setExistingProjectSearchState, {
        userId: args.userId,
        status: "ready",
        message:
          rows.length === 0
            ? "No Vercel projects found."
            : rows.length === 1
              ? "Found 1 Vercel project."
              : `Found ${rows.length} Vercel projects.`,
      });
    } catch (error) {
      await ctx.runMutation(internal.importsInternal.setExistingProjectSearchState, {
        userId: args.userId,
        status: "error",
        message: error instanceof Error ? error.message : "Search failed.",
      });
    }

    return null;
  },
});
