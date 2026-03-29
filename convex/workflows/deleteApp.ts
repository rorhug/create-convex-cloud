"use node";

import { createManagementClient } from "@convex-dev/platform";
import { Id } from "../_generated/dataModel";
import { ActionCtx, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Octokit } from "octokit";

async function setStep(
  ctx: ActionCtx,
  appId: Id<"apps">,
  step: string,
  status: string,
  message?: string,
) {
  await ctx.runMutation(internal.workflows.createAppHelpers.updateStep, {
    appId,
    step,
    status,
    message,
  });
}

function formatPlatformError(response: Response, error: unknown) {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }
  return response.statusText || `Request failed with status ${response.status}`;
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
    const steps: string[] = [];
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
        await setStep(ctx, args.appId, "github", "running", "Deleting GitHub repo...");
        const githubRepo = await ctx.runQuery(
          internal.workflows.deleteAppHelpers.getGithubRepo,
          { appId: args.appId },
        );
        if (githubRepo) {
          const user = await ctx.runQuery(
            internal.workflows.createAppHelpers.getUser,
            { userId: args.userId },
          );
          if (user?.githubAccessToken) {
            try {
              const octokit = new Octokit({ auth: user.githubAccessToken });
              const [owner, repo] = githubRepo.repoFullName.split("/");
              await octokit.request("DELETE /repos/{owner}/{repo}", {
                owner,
                repo,
                headers: { "X-GitHub-Api-Version": "2022-11-28" },
              });
              await setStep(ctx, args.appId, "github", "done", `Deleted ${githubRepo.repoFullName}`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Unknown error";
              await setStep(ctx, args.appId, "github", "error", msg);
            }
          } else {
            await setStep(ctx, args.appId, "github", "done", "No GitHub token, skipped API deletion");
          }
        } else {
          await setStep(ctx, args.appId, "github", "done", "No repo record found, skipped");
        }
      }

      // Delete Convex project
      if (args.deleteConvexProject) {
        await setStep(ctx, args.appId, "convex", "running", "Deleting Convex project...");
        const convexProject = await ctx.runQuery(
          internal.workflows.deleteAppHelpers.getConvexProject,
          { appId: args.appId },
        );
        if (convexProject) {
          const convexToken = await ctx.runQuery(
            internal.workflows.createAppHelpers.getConvexToken,
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
              if (!deleteProjectResult.response.ok) {
                const platformError =
                  "error" in deleteProjectResult ? deleteProjectResult.error : undefined;
                await setStep(
                  ctx,
                  args.appId,
                  "convex",
                  "error",
                  `API error: ${formatPlatformError(
                    deleteProjectResult.response,
                    platformError,
                  )}`,
                );
              } else {
                await setStep(ctx, args.appId, "convex", "done", "Deleted Convex project");
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Unknown error";
              await setStep(ctx, args.appId, "convex", "error", msg);
            }
          } else {
            await setStep(ctx, args.appId, "convex", "done", "No Convex token, skipped API deletion");
          }
        } else {
          await setStep(ctx, args.appId, "convex", "done", "No project record found, skipped");
        }
      }

      // Delete Vercel project
      if (args.deleteVercelProject) {
        await setStep(ctx, args.appId, "vercel", "running", "Deleting Vercel project...");
        const vercelProject = await ctx.runQuery(
          internal.workflows.deleteAppHelpers.getVercelProject,
          { appId: args.appId },
        );
        if (vercelProject) {
          const vercelToken = await ctx.runQuery(
            internal.workflows.createAppHelpers.getVercelToken,
            { userId: args.userId },
          );
          if (vercelToken) {
            const teamParam = vercelProject.teamId
              ? `?teamId=${vercelProject.teamId}`
              : "";
            try {
              const response = await fetch(
                `https://api.vercel.com/v9/projects/${vercelProject.projectId}${teamParam}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${vercelToken.token}` },
                },
              );
              if (!response.ok) {
                const text = await response.text();
                await setStep(ctx, args.appId, "vercel", "error", `API error: ${text}`);
              } else {
                await setStep(ctx, args.appId, "vercel", "done", "Deleted Vercel project");
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : "Unknown error";
              await setStep(ctx, args.appId, "vercel", "error", msg);
            }
          } else {
            await setStep(ctx, args.appId, "vercel", "done", "No Vercel token, skipped API deletion");
          }
        } else {
          await setStep(ctx, args.appId, "vercel", "done", "No project record found, skipped");
        }
      }

      // Check if any step had an error
      const steps = await ctx.runQuery(
        internal.apps.getAppStepsInternal,
        { appId: args.appId },
      );
      const hasError = steps.some((s) => s.status === "error");

      if (hasError) {
        await ctx.runMutation(internal.apps.internalUpdateAppStatus, {
          id: args.appId,
          status: "error",
        });
      } else {
        // All done - delete DB records
        await ctx.runMutation(internal.apps.internalDeleteApp, {
          id: args.appId,
          userId: args.userId,
        });
      }
    } catch (error) {
      console.error("Delete workflow failed:", error);
      await ctx.runMutation(internal.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "error",
      });
    }

    return null;
  },
});
