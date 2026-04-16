"use node";

import { createManagementClient } from "@convex-dev/platform";
import { Id } from "../_generated/dataModel";
import { ActionCtx, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Octokit } from "octokit";
import {
  deleteVercelProject,
} from "../lib/providers/vercel/platform";
import {
  assertConvexPlatformResultOk,
} from "../lib/providers/convex/platform";
import type { StepService, StepStatus } from "./stepTypes";

async function setStep(
  ctx: ActionCtx,
  appId: Id<"apps">,
  step: StepService,
  status: StepStatus,
  message?: string,
) {
  await ctx.runMutation(internal.workflows.createAppHelpers.updateStep, {
    appId,
    step,
    status,
    message,
  });
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

export const runDeleteAppWorkflow = internalAction({
  args: {
    appId: v.id("apps"),
    userId: v.id("users"),
    deleteGithubRepo: v.boolean(),
    deleteConvexProject: v.boolean(),
    deleteVercelProject: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Initialize step records for selected deletions
    const steps: StepService[] = [];
    if (args.deleteGithubRepo) steps.push("github");
    if (args.deleteConvexProject) steps.push("convex");
    if (args.deleteVercelProject) steps.push("vercel");

    await ctx.runMutation(internal.workflows.createAppHelpers.initSteps, {
      appId: args.appId,
      steps,
    });

    try {
      // Delete GitHub repo
      if (args.deleteGithubRepo) {
        await setStep(ctx, args.appId, "github", "deleting", "Deleting GitHub repo...");
        const githubRepo = await ctx.runQuery(
          internal.lib.providers.github.data.getGithubRepoByAppId,
          { appId: args.appId },
        );
        if (githubRepo) {
          const githubConnection = await ctx.runQuery(
            internal.lib.providers.github.data.getGithubConnection,
            { userId: args.userId },
          );
          if (githubConnection?.githubAccessToken) {
            try {
              const { accessToken } = await ctx.runAction(
                internal.workflows.githubAccessTokenAction.ensureFreshGithubAccessToken,
                { userId: args.userId },
              );
              const octokit = new Octokit({
                auth: accessToken,
              });
              const [owner, repo] = githubRepo.repoFullName.split("/");
              await octokit.request("DELETE /repos/{owner}/{repo}", {
                owner,
                repo,
                headers: { "X-GitHub-Api-Version": "2022-11-28" },
              });
              await setStep(ctx, args.appId, "github", "ready", `Deleted ${githubRepo.repoFullName}`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Unknown error";
              await setStep(ctx, args.appId, "github", "error", msg);
            }
          } else {
            await setStep(ctx, args.appId, "github", "ready", "No GitHub token, skipped API deletion");
          }
        } else {
          await setStep(ctx, args.appId, "github", "ready", "No repo record found, skipped");
        }
      }

      // Delete Convex project
      if (args.deleteConvexProject) {
        await setStep(ctx, args.appId, "convex", "deleting", "Deleting Convex project...");
        const convexProject = await ctx.runQuery(
          internal.lib.providers.convex.data.getConvexProjectByAppId,
          { appId: args.appId },
        );
        if (convexProject) {
          const convexToken = await ctx.runQuery(
            internal.lib.providers.convex.data.getConvexTokenForUser,
            { userId: args.userId },
          );
          if (convexToken) {
            try {
              const projectId = Number(convexProject.projectId);
              if (!isFiniteNumber(projectId)) {
                throw new Error(`Invalid Convex project ID: ${convexProject.projectId}`);
              }

              const convexPlatform = createManagementClient(convexToken.token);
              const deleteProjectResult = await convexPlatform.POST(
                "/projects/{project_id}/delete",
                {
                  params: { path: { project_id: projectId } },
                },
              );
              await assertConvexPlatformResultOk(
                ctx,
                convexToken.token,
                deleteProjectResult,
                "Failed to delete project",
              );
              await setStep(ctx, args.appId, "convex", "ready", "Deleted Convex project");
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Unknown error";
              await setStep(ctx, args.appId, "convex", "error", msg);
            }
          } else {
            await setStep(ctx, args.appId, "convex", "ready", "No Convex token, skipped API deletion");
          }
        } else {
          await setStep(ctx, args.appId, "convex", "ready", "No project record found, skipped");
        }
      }

      // Delete Vercel project
      if (args.deleteVercelProject) {
        await setStep(ctx, args.appId, "vercel", "deleting", "Deleting Vercel project...");
        const vercelProject = await ctx.runQuery(
          internal.lib.providers.vercel.data.getVercelProjectByAppId,
          { appId: args.appId },
        );
        if (vercelProject) {
          const vercelToken = await ctx.runQuery(
            internal.lib.providers.vercel.data.getVercelTokenForUser,
            { userId: args.userId },
          );
          if (vercelToken) {
            try {
              await deleteVercelProject(
                ctx,
                vercelToken.token,
                vercelProject.projectId,
                vercelProject.teamId,
              );
              await setStep(ctx, args.appId, "vercel", "ready", "Deleted Vercel project");
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Unknown error";
              await setStep(ctx, args.appId, "vercel", "error", msg);
            }
          } else {
            await setStep(ctx, args.appId, "vercel", "ready", "No Vercel token, skipped API deletion");
          }
        } else {
          await setStep(ctx, args.appId, "vercel", "ready", "No project record found, skipped");
        }
      }

      // Check if any step had an error
      const steps = await ctx.runQuery(
        internal.client.apps.getAppStepsInternal,
        { appId: args.appId },
      );
      const hasError = steps.some((s: { status: StepStatus }) => s.status === "error");

      if (hasError) {
        await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
          id: args.appId,
          status: "error",
        });
      } else {
        // All done - delete DB records
        await ctx.runMutation(internal.client.apps.internalDeleteApp, {
          id: args.appId,
          userId: args.userId,
        });
      }
    } catch (error) {
      console.error("Delete workflow failed:", error);
      await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "error",
      });
    }

    return null;
  },
});
