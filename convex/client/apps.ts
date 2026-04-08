import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireCurrentUser, requireCurrentUserId } from "../lib/auth";
import {
  appSummaryValidator,
  internalAppValidator,
  mapAppSummary,
  mapInternalApp,
  validateCreateAppSelections,
} from "../lib/apps";
import { createAppForUser, deleteAppForUser, listAppsForUser } from "../lib/onboarding";
import type { StepService, StepStatus } from "../workflows/stepTypes";
import {
  stepServiceValidator,
  stepStatusValidator,
} from "../workflows/stepTypes";

export const listApps = query({
  args: {},
  returns: v.array(appSummaryValidator),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    const apps = await listAppsForUser(ctx, user._id);
    return apps.map(mapAppSummary);
  },
});

export const createApp = mutation({
  args: {
    name: v.string(),
    vercelTeamId: v.string(),
    githubInstallationId: v.string(),
    githubRepoVisibility: v.union(v.literal("public"), v.literal("private")),
  },
  returns: v.id("apps"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const { githubInstallationId, vercelTeamId } =
      await validateCreateAppSelections(ctx, user._id, {
        githubInstallationId: args.githubInstallationId,
        vercelTeamId: args.vercelTeamId,
      });

    const appId = await createAppForUser(ctx, user._id, args.name, {
      vercelTeamId,
      githubInstallationId,
      githubRepoPrivate: args.githubRepoVisibility === "private",
    });

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

    const app = await ctx.runQuery(internal.client.apps.internalGetApp, {
      id: args.id,
    });
    if (!app) {
      throw new Error("App not found");
    }
    if (app.ownerId !== userId) {
      throw new Error("You do not own this app");
    }

    await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
      id: args.id,
      status: "deleting",
    });

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
  step: stepServiceValidator,
  status: stepStatusValidator,
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
    return steps.map((step) => ({
      step: step.step as StepService,
      status: step.status as StepStatus,
      message: step.message ?? null,
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

export const internalGetApp = internalQuery({
  args: { id: v.id("apps") },
  returns: v.union(internalAppValidator, v.null()),
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.id);
    if (!app) return null;
    return mapInternalApp(app);
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
  returns: v.array(v.object({ step: stepServiceValidator, status: stepStatusValidator })),
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();
    return steps.map((step) => ({
      step: step.step as StepService,
      status: step.status as StepStatus,
    }));
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
