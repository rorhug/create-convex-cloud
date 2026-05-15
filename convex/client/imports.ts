import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { userMutation, userQuery } from "../functions";
import {
  existingProjectsViewValidator,
  getExistingProjectBlockingReasons,
  isExistingProjectReadyForImport,
  normalizeGithubRepoFullName,
  toExistingProjectSummary,
  type ExistingProjectMatchSets,
} from "../lib/imports";

async function buildExistingProjectMatchSets(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<ExistingProjectMatchSets> {
  const apps = await ctx.db
    .query("apps")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .order("desc")
    .collect();
  const matches: ExistingProjectMatchSets = {
    vercelProjectIds: new Set<string>(),
    githubRepoFullNames: new Set<string>(),
    convexProjectIds: new Set<string>(),
  };

  for (const app of apps) {
    const [githubRepo, vercelProject, convexProject] = await Promise.all([
      ctx.db
        .query("githubRepos")
        .withIndex("by_app", (q) => q.eq("appId", app._id))
        .first(),
      ctx.db
        .query("vercelProjects")
        .withIndex("by_app", (q) => q.eq("appId", app._id))
        .first(),
      ctx.db
        .query("convexProjects")
        .withIndex("by_app", (q) => q.eq("appId", app._id))
        .first(),
    ]);

    if (githubRepo) {
      matches.githubRepoFullNames.add(normalizeGithubRepoFullName(githubRepo.repoFullName));
    }
    if (vercelProject) {
      matches.vercelProjectIds.add(vercelProject.projectId);
    }
    if (convexProject) {
      matches.convexProjectIds.add(convexProject.projectId);
    }
  }

  return matches;
}

export const getExistingProjects = userQuery({
  args: {},
  returns: existingProjectsViewValidator,
  handler: async (ctx) => {
    const [searchState, rows, matches] = await Promise.all([
      ctx.db
        .query("existingProjectSearches")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.userId))
        .first(),
      ctx.db
        .query("existingProjects")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.userId))
        .collect(),
      buildExistingProjectMatchSets(ctx, ctx.userId),
    ]);

    const projects = rows
      .map((row) => toExistingProjectSummary(row, matches))
      .sort((left, right) => {
        if (left.importable !== right.importable) {
          return left.importable ? -1 : 1;
        }
        return left.vercelProjectName.localeCompare(right.vercelProjectName);
      });

    return {
      status: searchState?.status ?? "idle",
      message: searchState?.message ?? null,
      updatedAt: searchState?.updatedAt ?? null,
      projects,
    };
  },
});

export const scheduleExistingProjectSearch = userMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.importsInternal.setExistingProjectSearchState, {
      userId: ctx.userId,
      status: "searching",
      message: "Searching Vercel projects...",
    });
    await ctx.scheduler.runAfter(0, internal.importsActions.searchExistingProjects, {
      userId: ctx.userId,
    });

    return null;
  },
});

export const importExistingProject = userMutation({
  args: {
    existingProjectId: v.id("existingProjects"),
  },
  returns: v.id("apps"),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("existingProjects", args.existingProjectId);
    if (!project || project.ownerId !== ctx.userId) {
      throw new Error("Import candidate not found");
    }

    const matches = await buildExistingProjectMatchSets(ctx, ctx.userId);
    if (!isExistingProjectReadyForImport(project, matches)) {
      const reasons = getExistingProjectBlockingReasons(project, matches);
      throw new Error(reasons[0] ?? "This project cannot be imported.");
    }

    const appId = await ctx.db.insert("apps", {
      ownerId: ctx.userId,
      name: project.vercelProjectName,
      vercelTeamId: project.vercelTeamId,
      githubInstallationId: project.githubInstallationId,
      githubRepoPrivate: project.githubRepoPrivate,
      githubRepoCreationMethod: "clone",
      status: "ready",
      createdAt: Date.now(),
    });

    await ctx.db.insert("githubRepos", {
      appId,
      repoFullName: project.githubRepoFullName,
      repoUrl: project.githubRepoUrl,
    });
    await ctx.db.insert("convexProjects", {
      appId,
      projectId: project.convexProjectId,
      teamId: project.convexTeamId,
      teamSlug: project.convexTeamSlug,
      projectSlug: project.convexProjectSlug,
      prodDeploymentName: project.convexProdDeploymentName,
      prodDeployKey: project.prodDeployKey,
      ...(project.previewDeployKey ? { previewDeployKey: project.previewDeployKey } : {}),
    });
    await ctx.db.insert("vercelProjects", {
      appId,
      projectId: project.vercelProjectId,
      projectName: project.vercelProjectName,
      teamId: project.vercelTeamId,
      teamSlug: project.vercelTeamSlug,
      ...(project.deploymentUrl ? { deploymentUrl: project.deploymentUrl } : {}),
    });

    return appId;
  },
});
