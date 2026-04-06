import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { ActionCtx } from "../_generated/server";

/**
 * Convenience wrapper to update a step's status and optional message.
 * Used by all step action files so they don't each have to repeat this pattern.
 */
export async function setStep(ctx: ActionCtx, appId: Id<"apps">, step: string, status: string, message?: string): Promise<void> {
  await ctx.runMutation(internal.workflows.createAppHelpers.updateStep, {
    appId,
    step,
    status,
    message,
  });
}
