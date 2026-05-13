"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { stepServiceValidator } from "./stepTypes";

export const resumePipelineFromStep = internalAction({
  args: {
    appId: v.id("apps"),
    fromStep: stepServiceValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const app = await ctx.runQuery(internal.client.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
      id: args.appId,
      status: "creating",
    });

    await ctx.runMutation(internal.workflows.createAppHelpers.resetStepsFrom, {
      appId: args.appId,
      fromStep: args.fromStep,
    });

    try {
      const deploymentTarget = app.deploymentTarget ?? "vercel";

      async function runDeploymentStep(argsForStep: {
        repoFullName: string;
        prodDeployKey: string;
        previewDeployKey?: string;
      }) {
        if (deploymentTarget === "github-pages") {
          await ctx.runAction(internal.workflows.stepGithubPages.stepCreateGithubPagesDeployment, {
            appId: args.appId,
            repoFullName: argsForStep.repoFullName,
            prodDeployKey: argsForStep.prodDeployKey,
          });
          return;
        }

        if (!argsForStep.previewDeployKey) {
          throw new Error("Convex preview deploy key is required to retry the Vercel deployment step.");
        }
        const vercelResult = await ctx.runAction(internal.workflows.stepVercel.stepCreateVercelProject, {
          appId: args.appId,
          repoFullName: argsForStep.repoFullName,
          prodDeployKey: argsForStep.prodDeployKey,
          previewDeployKey: argsForStep.previewDeployKey,
        });
        if (vercelResult.deploymentId) {
          await ctx.runAction(internal.workflows.stepVercel.stepWaitForDeployment, {
            appId: args.appId,
            deploymentId: vercelResult.deploymentId,
            vercelToken: vercelResult.vercelToken,
            teamId: vercelResult.teamId,
            projectId: vercelResult.projectId,
          });
        }
      }

      if (args.fromStep === "github") {
        const githubResult = await ctx.runAction(
          internal.workflows.stepGithubRepoTemplate.stepCreateGithubRepoTemplate,
          { appId: args.appId },
        );
        const convexResult = await ctx.runAction(
          internal.workflows.stepConvex.stepCreateConvexProject,
          { appId: args.appId },
        );
        await runDeploymentStep({
          repoFullName: githubResult.repoFullName,
          prodDeployKey: convexResult.prodDeployKey,
          previewDeployKey: convexResult.previewDeployKey,
        });
      } else if (args.fromStep === "convex") {
        const githubRepo = await ctx.runQuery(internal.lib.providers.github.data.getGithubRepoByAppId, {
          appId: args.appId,
        });
        if (!githubRepo) {
          throw new Error("GitHub repository is not set up yet. Retry the GitHub step first.");
        }
        const convexResult = await ctx.runAction(
          internal.workflows.stepConvex.stepCreateConvexProject,
          { appId: args.appId },
        );
        await runDeploymentStep({
          repoFullName: githubRepo.repoFullName,
          prodDeployKey: convexResult.prodDeployKey,
          previewDeployKey: convexResult.previewDeployKey,
        });
      } else {
        const githubRepo = await ctx.runQuery(internal.lib.providers.github.data.getGithubRepoByAppId, {
          appId: args.appId,
        });
        if (!githubRepo) {
          throw new Error("GitHub repository is not set up yet. Retry the GitHub step first.");
        }
        const keys = await ctx.runQuery(internal.lib.providers.convex.data.getConvexDeployKeysByAppId, {
          appId: args.appId,
        });
        if (!keys) {
          throw new Error("Convex project is not set up yet. Retry the Convex step first.");
        }
        await runDeploymentStep({
          repoFullName: githubRepo.repoFullName,
          prodDeployKey: keys.prodDeployKey,
          previewDeployKey: keys.previewDeployKey,
        });
      }

      await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "ready",
      });
    } catch (error) {
      console.error("Resume create pipeline failed:", error);
      await ctx.runMutation(internal.client.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "error",
      });
    }
    return null;
  },
});
