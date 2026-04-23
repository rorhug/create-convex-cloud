import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireCurrentUser } from "../lib/auth";
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

export const getExistingProjects = query({
  args: {},
  returns: existingProjectsViewValidator,
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    const [searchState, rows, matches] = await Promise.all([
      ctx.db
        .query("existingProjectSearches")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .first(),
      ctx.db
        .query("existingProjects")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
      buildExistingProjectMatchSets(ctx, user._id),
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

export const scheduleExistingProjectSearch = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    await ctx.runMutation(internal.importsInternal.setExistingProjectSearchState, {
      userId: user._id,
      status: "searching",
      message: "Searching Vercel projects...",
    });
    await ctx.scheduler.runAfter(0, internal.importsActions.searchExistingProjects, {
      userId: user._id,
    });

    return null;
  },
});

export const importExistingProject = mutation({
  args: {
    existingProjectId: v.id("existingProjects"),
  },
  returns: v.id("apps"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const project = await ctx.db.get("existingProjects", args.existingProjectId);
    if (!project || project.ownerId !== user._id) {
      throw new Error("Import candidate not found");
    }

    const matches = await buildExistingProjectMatchSets(ctx, user._id);
    if (!isExistingProjectReadyForImport(project, matches)) {
      const reasons = getExistingProjectBlockingReasons(project, matches);
      throw new Error(reasons[0] ?? "This project cannot be imported.");
    }

    const appId = await ctx.db.insert("apps", {
      ownerId: user._id,
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
