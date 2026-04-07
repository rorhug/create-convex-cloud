import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
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
    await step.runMutation(internal.workflows.createAppHelpers.initSteps, {
      appId: args.appId,
      steps: ["github", "convex", "vercel"],
    });

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
          projectId: vercelResult.projectId,
        },
        { name: "waitForDeployment" },
      );
    }

    // Mark app as ready
    await step.runMutation(internal.client.apps.internalUpdateAppStatus, {
      id: args.appId,
      status: "ready",
    });
  },
});
