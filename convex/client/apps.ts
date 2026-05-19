import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { userAction, userMutation, userQuery } from "../functions";
import {
  appSummaryValidator,
  internalAppValidator,
  mapAppSummary,
  mapInternalApp,
  validateCreateAppSelections,
} from "../lib/apps";
import { assertValidAppName } from "../lib/appName";
import { createAppForUser, deleteAppForUser, listAppsForUser } from "../lib/onboarding";
import type { StepService, StepStatus } from "../workflows/stepTypes";
import { appStatusValidator } from "../lib/appStatus";
import { stepServiceValidator } from "../workflows/stepTypes";

type InternalApp = ReturnType<typeof mapInternalApp>;

export const listApps = userQuery({
  args: {},
  returns: v.array(appSummaryValidator),
  handler: async (ctx) => {
    const apps = await listAppsForUser(ctx, ctx.userId);
    return apps.map(mapAppSummary);
  },
});

const lastAppSelectionsValidator = v.union(
  v.object({
    githubInstallationId: v.string(),
    vercelTeamId: v.string(),
    githubRepoVisibility: v.union(v.literal("public"), v.literal("private")),
  }),
  v.null(),
);

export const getLastAppSelections = userQuery({
  args: {},
  returns: lastAppSelectionsValidator,
  handler: async (ctx) => {
    const apps = await listAppsForUser(ctx, ctx.userId);
    const latest = apps[0];
    if (!latest) return null;
    return {
      githubInstallationId: latest.githubInstallationId,
      vercelTeamId: latest.vercelTeamId,
      githubRepoVisibility: (latest.githubRepoPrivate ? "private" : "public") as "public" | "private",
    };
  },
});

export const createApp = userMutation({
  args: {
    name: v.string(),
    vercelTeamId: v.string(),
    githubInstallationId: v.string(),
    githubRepoVisibility: v.union(v.literal("public"), v.literal("private")),
  },
  returns: v.id("apps"),
  handler: async (ctx, args) => {
    assertValidAppName(args.name);

    const { githubInstallationId, vercelTeamId } = await validateCreateAppSelections(ctx, ctx.userId, {
      githubInstallationId: args.githubInstallationId,
      vercelTeamId: args.vercelTeamId,
    });

    const appId = await createAppForUser(ctx, ctx.userId, args.name, {
      vercelTeamId,
      githubInstallationId,
      githubRepoPrivate: args.githubRepoVisibility === "private",
    });

    await ctx.scheduler.runAfter(0, internal.workflows.createApp.runCreateAppWorkflow, { appId });

    return appId;
  },
});

export const deleteApp = userAction({
  args: {
    id: v.id("apps"),
    deleteGithubRepo: v.boolean(),
    deleteConvexProject: v.boolean(),
    deleteVercelProject: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const app: InternalApp | null = await ctx.runQuery(internal.client.apps.internalGetApp, {
      id: args.id,
    });
    if (!app) {
      throw new Error("App not found");
    }
    if (app.ownerId !== ctx.userId) {
      throw new Error("You do not own this app");
    }

    await ctx.runMutation(internal.client.apps.internalSetAppWorkflowKind, {
      id: args.id,
      workflowKind: "delete",
    });

    await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
      id: args.id,
      status: "deleting",
    });

    await ctx.scheduler.runAfter(0, internal.workflows.deleteApp.runDeleteAppWorkflow, {
      appId: args.id,
      userId: ctx.userId,
      deleteGithubRepo: args.deleteGithubRepo,
      deleteConvexProject: args.deleteConvexProject,
      deleteVercelProject: args.deleteVercelProject,
    });

    return null;
  },
});

export const retryFailedCreateStep = userAction({
  args: {
    appId: v.id("apps"),
    step: stepServiceValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const app = await ctx.runQuery(internal.client.apps.internalGetApp, {
      id: args.appId,
    });
    if (!app || app.ownerId !== ctx.userId) {
      throw new Error("App not found");
    }
    if ((app.workflowKind ?? "create") !== "create") {
      throw new Error("Retry is only available for app creation.");
    }
    if (app.status !== "error") {
      throw new Error("Retry is only available when app creation has failed.");
    }
    const steps: Array<{ step: StepService; status: StepStatus }> = await ctx.runQuery(
      internal.client.apps.getAppStepsInternal,
      {
      appId: args.appId,
      },
    );
    const row = steps.find((s: { step: StepService; status: StepStatus }) => s.step === args.step);
    if (!row || row.status !== "error") {
      throw new Error("This step is not in a failed state.");
    }
    console.error("[retryFailedCreateStep] scheduling resume pipeline", {
      appId: args.appId,
      step: args.step,
      workflowKind: app.workflowKind,
    });
    await ctx.scheduler.runAfter(0, internal.workflows.retryCreateApp.resumePipelineFromStep, {
      appId: args.appId,
      fromStep: args.step,
    });
    return null;
  },
});

export const refreshDeploymentMetadata = userAction({
  args: {
    appId: v.id("apps"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const app: InternalApp | null = await ctx.runQuery(internal.client.apps.internalGetApp, {
      id: args.appId,
    });
    if (!app || app.ownerId !== ctx.userId) {
      throw new Error("App not found");
    }

    const deploymentUrl: string | null = await ctx.runAction(
      internal.workflows.refreshDeploymentMetadata.refreshDeploymentMetadata,
      {
      appId: args.appId,
      userId: ctx.userId,
      },
    );
    return deploymentUrl;
  },
});

const stepValidator = v.object({
  step: stepServiceValidator,
  status: appStatusValidator,
  message: v.union(v.string(), v.null()),
});

export const getAppSteps = userQuery({
  args: { appId: v.id("apps") },
  returns: v.array(stepValidator),
  handler: async (ctx, args) => {
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

export const getAppDeploymentUrl = userQuery({
  args: { appId: v.id("apps") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
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
  /** Production deployment page `/t/{team}/{project}/{deployment}` (env vars for prod). */
  convexProdDeployment: v.union(v.string(), v.null()),
  /** Project settings with anchor on env vars — inherited by preview branch deployments. */
  convexDefaultEnvVars: v.union(v.string(), v.null()),
});

export const getAppDashboardLinks = userQuery({
  args: { appId: v.id("apps") },
  returns: dashboardLinksValidator,
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.appId);
    if (!app || app.ownerId !== ctx.userId) {
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
    let convexProdDeployment: string | null = null;
    let convexDefaultEnvVars: string | null = null;
    if (convexProject) {
      const base = `https://dashboard.convex.dev/t/${convexProject.teamSlug}/${convexProject.projectSlug}`;
      convex = base;
      convexProdDeployment = `${base}/${convexProject.prodDeploymentName}/settings/environment-variables`;
      convexDefaultEnvVars = `${base}/settings#env-vars`;
    }

    return {
      github: githubRepo?.repoUrl ?? null,
      vercel,
      convex,
      convexProdDeployment,
      convexDefaultEnvVars,
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
    status: appStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const internalSetAppWorkflowKind = internalMutation({
  args: {
    id: v.id("apps"),
    workflowKind: v.union(v.literal("create"), v.literal("delete")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { workflowKind: args.workflowKind });
    return null;
  },
});

export const getAppStepsInternal = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.array(v.object({ step: stepServiceValidator, status: appStatusValidator })),
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
