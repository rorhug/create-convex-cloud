import { internal } from "../_generated/api";

/**
 * Convenience wrapper to update a step's status and optional message.
 * Used by all step action files so they don't each have to repeat this pattern.
 */
export async function setStep(
  ctx: any,
  appId: any,
  step: string,
  status: string,
  message?: string,
): Promise<void> {
  await ctx.runMutation(internal.workflows.createAppHelpers.updateStep, {
    appId,
    step,
    status,
    message,
  });
}
