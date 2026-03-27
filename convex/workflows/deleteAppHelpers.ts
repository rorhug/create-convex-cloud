import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getGithubRepo = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      repoFullName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("githubRepos")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!repo) return null;
    return { repoFullName: repo.repoFullName };
  },
});

export const getConvexProject = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      projectId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("convexProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!project) return null;
    return { projectId: project.projectId };
  },
});

export const getVercelProject = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      projectId: v.string(),
      teamId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("vercelProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!project) return null;
    return { projectId: project.projectId, teamId: project.teamId ?? null };
  },
});
