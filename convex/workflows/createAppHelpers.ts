import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    retryActionsByDefault: false,
  },
});

// --- Step tracking mutations ---

export const initSteps = internalMutation({
  args: {
    appId: v.id("apps"),
    steps: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Clear any existing steps for this app first
    const existing = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();
    for (const s of existing) {
      await ctx.db.delete(s._id);
    }

    for (const step of args.steps) {
      await ctx.db.insert("appSteps", {
        appId: args.appId,
        step,
        status: "pending",
      });
    }
    return null;
  },
});

export const updateStep = internalMutation({
  args: {
    appId: v.id("apps"),
    step: v.string(),
    status: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .filter((q) => q.eq(q.field("step"), args.step))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        message: args.message,
      });
    }
    return null;
  },
});

// --- Workflow definition (must be in non-node file since it's a mutation) ---

export const createApp = workflow.define({
  args: {
    appId: v.id("apps"),
  },
  handler: async (step, args): Promise<void> => {
    // Initialize step records
    await step.runMutation(
      internal.workflows.createAppHelpers.initSteps,
      { appId: args.appId, steps: ["github", "convex", "vercel"] },
    );

    // Steps 1 & 2 in parallel: GitHub repo + Convex project
    const [githubResult, convexResult] = await Promise.all([
      step.runAction(
        internal.workflows.stepGithub.stepCreateGithubRepo,
        { appId: args.appId },
        { name: "createGithubRepo", retry: true },
      ),
      step.runAction(
        internal.workflows.stepConvex.stepCreateConvexProject,
        { appId: args.appId },
        { name: "createConvexProject", retry: true },
      ),
    ]);

    // Step 3: Create Vercel project (depends on both previous steps)
    const vercelResult = await step.runAction(
      internal.workflows.stepVercel.stepCreateVercelProject,
      {
        appId: args.appId,
        repoFullName: githubResult.repoFullName,
        prodDeployKey: convexResult.prodDeployKey,
        previewDeployKey: convexResult.previewDeployKey,
      },
      { name: "createVercelProject", retry: true },
    );

    // Step 4: Wait for deployment to finish
    if (vercelResult.deploymentId) {
      await step.runAction(
        internal.workflows.stepVercel.stepWaitForDeployment,
        {
          appId: args.appId,
          deploymentId: vercelResult.deploymentId,
          vercelToken: vercelResult.vercelToken,
          teamId: vercelResult.teamId,
          deploymentUrl: vercelResult.deploymentUrl,
        },
        { name: "waitForDeployment" },
      );
    }

    // Mark app as ready
    await step.runMutation(internal.apps.internalUpdateAppStatus, {
      id: args.appId,
      status: "ready",
    });
  },
});

// --- Data queries ---

export const getGithubConnection = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      githubAccessToken: v.union(v.string(), v.null()),
      githubUsername: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const githubToken = await ctx.db
      .query("githubTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!githubToken) return null;
    return {
      githubAccessToken: githubToken.token,
      githubUsername: githubToken.username ?? null,
    };
  },
});

export const getConvexToken = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      token: v.string(),
      teamId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("convexTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!tokenDoc) return null;
    return { token: tokenDoc.token, teamId: tokenDoc.teamId };
  },
});

export const getVercelToken = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      token: v.string(),
      teams: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          slug: v.string(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("vercelTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!tokenDoc) return null;
    return { token: tokenDoc.token, teams: tokenDoc.teams };
  },
});

// --- Resource insert mutations ---

export const insertGithubRepo = internalMutation({
  args: {
    appId: v.id("apps"),
    repoFullName: v.string(),
    repoUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("githubRepos", {
      appId: args.appId,
      repoFullName: args.repoFullName,
      repoUrl: args.repoUrl,
    });
    return null;
  },
});

export const insertConvexProject = internalMutation({
  args: {
    appId: v.id("apps"),
    projectId: v.string(),
    teamId: v.string(),
    prodDeploymentName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("convexProjects", {
      appId: args.appId,
      projectId: args.projectId,
      teamId: args.teamId,
      prodDeploymentName: args.prodDeploymentName,
      prodDeployKey: args.prodDeployKey,
      previewDeployKey: args.previewDeployKey,
    });
    return null;
  },
});

export const insertVercelProject = internalMutation({
  args: {
    appId: v.id("apps"),
    projectId: v.string(),
    projectName: v.string(),
    teamId: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("vercelProjects", {
      appId: args.appId,
      projectId: args.projectId,
      projectName: args.projectName,
      teamId: args.teamId,
      deploymentUrl: args.deploymentUrl,
    });
    return null;
  },
});
