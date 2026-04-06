import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser, requireCurrentUserId } from "./lib/auth";
import { getGithubTokenDocForUser } from "./lib/githubAuthAccount";
import { githubAccessTokenNeedsRefresh } from "./lib/githubAccessToken";
import { createAppForUser, deleteAppForUser, listAppsForUser } from "./lib/onboarding";

const appValidator = v.object({
  _id: v.id("apps"),
  name: v.string(),
  status: v.string(),
  createdAt: v.number(),
});

export const listApps = query({
  args: {},
  returns: v.array(appValidator),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    const apps = await listAppsForUser(ctx, user._id);
    return apps.map((app) => ({
      _id: app._id,
      name: app.name,
      status: app.status,
      createdAt: app.createdAt,
    }));
  },
});

export const createApp = mutation({
  args: {
    name: v.string(),
    vercelTeamId: v.string(),
  },
  returns: v.id("apps"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Check tokens exist
    const vercelToken = await ctx.db
      .query("vercelTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!vercelToken) {
      throw new Error("Connect your Vercel account before creating apps");
    }

    const teams = vercelToken.teams;
    const vercelTeamId = args.vercelTeamId.trim();
    if (!vercelTeamId) {
      throw new Error("Select a Vercel team");
    }
    if (!teams.some((t) => t.id === vercelTeamId)) {
      throw new Error("That Vercel team is not available for your account. Re-verify your Vercel token on the setup page.");
    }

    const convexToken = await ctx.db
      .query("convexTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!convexToken) {
      throw new Error("Connect your Convex account before creating apps");
    }

    const githubToken = await getGithubTokenDocForUser(ctx, user._id);
    if (!githubToken) {
      throw new Error("GitHub access token not available. Please sign out and sign in again.");
    }
    if (githubAccessTokenNeedsRefresh(githubToken.accessTokenExpiresAt) && !githubToken.refreshToken) {
      throw new Error(
        "GitHub access token expired or expiring and cannot be refreshed automatically. Sign in with GitHub again.",
      );
    }

    const appId = await createAppForUser(ctx, user._id, args.name, { vercelTeamId });

    // Schedule the creation workflow
    await ctx.scheduler.runAfter(0, internal.workflows.createApp.runCreateAppWorkflow, { appId });

    return appId;
  },
});

export const deleteApp = action({
  args: {
    id: v.id("apps"),
    deleteGithubRepo: v.boolean(),
    deleteConvexProject: v.boolean(),
    deleteVercelProject: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);

    // Verify ownership
    const app = await ctx.runQuery(internal.apps.internalGetApp, {
      id: args.id,
    });
    if (!app) {
      throw new Error("App not found");
    }
    if (app.ownerId !== userId) {
      throw new Error("You do not own this app");
    }

    // Set status to deleting
    await ctx.runMutation(internal.apps.internalUpdateAppStatus, {
      id: args.id,
      status: "deleting",
    });

    // Schedule the delete workflow
    await ctx.scheduler.runAfter(0, internal.workflows.deleteApp.runDeleteAppWorkflow, {
      appId: args.id,
      userId,
      deleteGithubRepo: args.deleteGithubRepo,
      deleteConvexProject: args.deleteConvexProject,
      deleteVercelProject: args.deleteVercelProject,
    });

    return null;
  },
});

const stepValidator = v.object({
  step: v.string(),
  status: v.string(),
  message: v.union(v.string(), v.null()),
});

export const getAppSteps = query({
  args: { appId: v.id("apps") },
  returns: v.array(stepValidator),
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx);
    const steps = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();
    return steps.map((s) => ({
      step: s.step,
      status: s.status,
      message: s.message ?? null,
    }));
  },
});

export const getAppDeploymentUrl = query({
  args: { appId: v.id("apps") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx);
    const vercelProject = await ctx.db
      .query("vercelProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    return vercelProject?.deploymentUrl ?? null;
  },
});

const dashboardLinksValidator = v.object({
  github: v.union(v.string(), v.null()),
  vercel: v.union(v.string(), v.null()),
  convex: v.union(v.string(), v.null()),
});

export const getAppDashboardLinks = query({
  args: { appId: v.id("apps") },
  returns: dashboardLinksValidator,
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const app = await ctx.db.get(args.appId);
    if (!app || app.ownerId !== user._id) {
      throw new Error("App not found");
    }

    const githubRepo = await ctx.db
      .query("githubRepos")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();

    const vercelProject = await ctx.db
      .query("vercelProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();

    const convexProject = await ctx.db
      .query("convexProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();

    let vercel: string | null = null;
    if (vercelProject) {
      vercel = `https://vercel.com/${vercelProject.teamSlug}/${vercelProject.projectName}`;
    }

    let convex: string | null = null;
    if (convexProject) {
      convex = `https://dashboard.convex.dev/t/${convexProject.teamSlug}/${convexProject.projectSlug}`;
    }

    return {
      github: githubRepo?.repoUrl ?? null,
      vercel,
      convex,
    };
  },
});

// Internal mutations used by workflows
export const internalGetApp = internalQuery({
  args: { id: v.id("apps") },
  returns: v.union(
    v.object({
      _id: v.id("apps"),
      ownerId: v.id("users"),
      name: v.string(),
      status: v.string(),
      vercelTeamId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.id);
    if (!app) return null;
    return {
      _id: app._id,
      ownerId: app.ownerId,
      name: app.name,
      status: app.status,
      vercelTeamId: app.vercelTeamId,
    };
  },
});

export const internalUpdateAppStatus = internalMutation({
  args: {
    id: v.id("apps"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const getAppStepsInternal = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.array(v.object({ step: v.string(), status: v.string() })),
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();
    return steps.map((s) => ({ step: s.step, status: s.status }));
  },
});

export const internalDeleteApp = internalMutation({
  args: {
    id: v.id("apps"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteAppForUser(ctx, args.userId, args.id);
    return null;
  },
});
