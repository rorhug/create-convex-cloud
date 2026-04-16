import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { type StepService, stepServiceValidator, stepStatusValidator } from "./stepTypes";

const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    retryActionsByDefault: false,
  },
});

// --- Step tracking mutations ---

export const initSteps = internalMutation({
  args: {
    appId: v.id("apps"),
    steps: v.array(stepServiceValidator),
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
    step: stepServiceValidator,
    status: stepStatusValidator,
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existingSteps = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();
    const existing = existingSteps.find((step) => step.step === args.step);
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        message: args.message,
      });
    }
    return null;
  },
});

const STEP_ORDER: StepService[] = ["github", "convex", "vercel"];

/** Reset this step and all following steps to pending (for retry from a failed step). */
export const resetStepsFrom = internalMutation({
  args: {
    appId: v.id("apps"),
    fromStep: stepServiceValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const start = STEP_ORDER.indexOf(args.fromStep);
    if (start === -1) {
      return null;
    }
    const existingSteps = await ctx.db
      .query("appSteps")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();
    for (let i = start; i < STEP_ORDER.length; i++) {
      const name = STEP_ORDER[i]!;
      const row = existingSteps.find((s) => s.step === name);
      if (row) {
        await ctx.db.patch(row._id, {
          status: "pending",
          message: undefined,
        });
      }
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
    try {
      // Initialize step records
      await step.runMutation(internal.workflows.createAppHelpers.initSteps, {
        appId: args.appId,
        steps: ["github", "convex", "vercel"],
      });

      const app = await step.runQuery(internal.client.apps.internalGetApp, {
        id: args.appId,
      });
      if (!app) {
        throw new Error("App not found");
      }

      // Steps 1 & 2 in parallel: GitHub repo + Convex project
      const [githubResult, convexResult] = await Promise.all([
        step.runAction(
          internal.workflows.stepGithubRepoTemplate.stepCreateGithubRepoTemplate,
          { appId: args.appId },
          { name: "createGithubRepoTemplate" },
        ),
        step.runAction(
          internal.workflows.stepConvex.stepCreateConvexProject,
          { appId: args.appId },
          { name: "createConvexProject" },
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
        { name: "createVercelProject" },
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

      await step.runMutation(internal.client.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "ready",
      });
    } catch (error) {
      console.error("Create app workflow failed:", error);
      await step.runMutation(internal.client.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "error",
      });
    }
  },
});
