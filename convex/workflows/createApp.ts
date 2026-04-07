"use node";

import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    retryActionsByDefault: false,
  },
});

/**
 * Entrypoint: starts the multi-step app-creation workflow.
 * Called by the scheduler immediately after an app record is created.
 */
export const runCreateAppWorkflow = internalAction({
  args: { appId: v.id("apps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await workflow.start(ctx, internal.workflows.createAppHelpers.createApp, { appId: args.appId });
    } catch (error) {
      console.error("Failed to start create app workflow:", error);
      await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "error",
      });
    }
    return null;
  },
});
