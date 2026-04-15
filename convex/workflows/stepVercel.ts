"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import {
  createVercelDeployment,
  createVercelProject,
  getVercelErrorMessage,
  getVercelDeployment,
  isVercelTokenInvalidError,
  isRetryableVercelGitError,
  sleepMs,
} from "../lib/providers/vercel/platform";
import { setStep } from "./stepUtils";
import { Id } from "../_generated/dataModel";

export const stepCreateVercelProject = internalAction({
  args: {
    appId: v.id("apps"),
    repoFullName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  },
  returns: v.object({
    projectId: v.id("vercelProjects"),
    projectName: v.string(),
    // deploymentUrl: v.string(),
    deploymentId: v.optional(v.string()),
    vercelToken: v.string(),
    teamId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    projectId: Id<"vercelProjects">;
    projectName: string;
    // deploymentUrl: string;
    deploymentId?: string;
    vercelToken: string;
    teamId: string;
  }> => {
    await setStep(ctx, args.appId, "vercel", "running", "Creating Vercel project...");

    const app = await ctx.runQuery(internal.client.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    const vercelToken = await ctx.runQuery(internal.lib.providers.vercel.data.getVercelTokenForUser, {
      userId: app.ownerId,
    });
    if (!vercelToken) {
      await setStep(ctx, args.appId, "vercel", "error", "Vercel token not found");
      throw new Error("Vercel token not found for user");
    }

    try {
      const teamId: string = app.vercelTeamId;
      const team = vercelToken.teams.find((t: { id: string; slug: string }) => t.id === teamId);
      if (!team) {
        throw new Error("Selected Vercel team not found for this token; re-save your Vercel token on the setup page.");
      }
      const teamSlug = team.slug;

      let project: Awaited<ReturnType<typeof createVercelProject>> | undefined;
      const projectCreateDelaysMs = [0, 2_000, 5_000, 10_000];
      for (let attempt = 0; attempt < projectCreateDelaysMs.length; attempt++) {
        const delayMs = projectCreateDelaysMs[attempt]!;
        if (delayMs > 0) {
          await setStep(
            ctx,
            args.appId,
            "vercel",
            "running",
            `Waiting for GitHub repo to propagate to Vercel... (${Math.round(delayMs / 1000)}s)`,
          );
          await sleepMs(delayMs);
        }
        try {
          project = await createVercelProject(ctx, vercelToken.token, teamId, {
            name: app.name,
            framework: "nextjs",
            gitRepository: {
              type: "github",
              repo: args.repoFullName,
            },
            environmentVariables: [
              {
                key: "CONVEX_DEPLOY_KEY",
                value: args.prodDeployKey,
                target: ["production"],
                type: "encrypted",
              },
              {
                key: "CONVEX_DEPLOY_KEY",
                value: args.previewDeployKey,
                target: ["preview"],
                type: "encrypted",
              },
            ],
          });
          break;
        } catch (error) {
          if (attempt === projectCreateDelaysMs.length - 1 || !isRetryableVercelGitError(error)) {
            throw error;
          }
        }
      }
      if (!project) {
        throw new Error("Vercel project creation failed with no response");
      }

      // const deploymentUrl = `https://${project.name}.vercel.app`;

      // Trigger initial deployment
      await setStep(ctx, args.appId, "vercel", "running", "Triggering first deployment...");
      const [repoOrg, repoName] = args.repoFullName.split("/");

      let deploymentId: string | undefined;
      const deployDelaysMs = [0, 2_000, 5_000];
      for (let attempt = 0; attempt < deployDelaysMs.length; attempt++) {
        const delayMs = deployDelaysMs[attempt]!;
        if (delayMs > 0) {
          await setStep(
            ctx,
            args.appId,
            "vercel",
            "running",
            `Waiting before triggering deployment... (${Math.round(delayMs / 1000)}s)`,
          );
          await sleepMs(delayMs);
        }
        try {
          const deployData = await createVercelDeployment(
            ctx,
            vercelToken.token,
            teamId,
            {
            name: project.name,
            target: "production",
            gitSource: {
              type: "github",
              org: repoOrg,
              repo: repoName,
              ref: "main",
            },
            },
          );
          deploymentId = deployData.id;
          break;
        } catch (error) {
          if (attempt === deployDelaysMs.length - 1 || !isRetryableVercelGitError(error)) {
            console.error("Failed to trigger deployment (non-fatal):", error);
            break;
          }
        }
      }

      const projectId = await ctx.runMutation(internal.lib.providers.vercel.data.insertVercelProject, {
        appId: args.appId,
        projectId: project.id,
        projectName: project.name,
        teamId,
        teamSlug,
        // deploymentUrl,
      });

      await setStep(ctx, args.appId, "vercel", "running", "Deploying...");
      return {
        projectId,
        projectName: project.name,
        // deploymentUrl,
        deploymentId,
        vercelToken: vercelToken.token,
        teamId,
      };
    } catch (error) {
      const msg = getVercelErrorMessage(error);
      await setStep(ctx, args.appId, "vercel", "error", msg);
      throw error;
    }
  },
});

export const stepWaitForDeployment = internalAction({
  args: {
    appId: v.id("apps"),
    deploymentId: v.string(),
    vercelToken: v.string(),
    teamId: v.string(),
    projectId: v.id("vercelProjects"),
  },
  returns: v.object({ status: v.string() }),
  handler: async (ctx, args): Promise<{ status: string }> => {
    await setStep(ctx, args.appId, "vercel", "running", "Waiting for deployment to finish...");
    const app = await ctx.runQuery(internal.client.apps.internalGetApp, { id: args.appId });
    if (!app) {
      throw new Error("App not found");
    }

    const maxAttempts = 30; // ~5 minutes (10s intervals)
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const data = await getVercelDeployment(
          ctx,
          args.vercelToken,
          args.deploymentId,
          args.teamId,
        );
        const state = data.readyState;
        const deploymentAlias = data.alias?.[0];

        if (state === "READY") {
          if (deploymentAlias) {
            const deploymentUrl = deploymentAlias ? `https://${deploymentAlias}` : undefined;
            await setStep(ctx, args.appId, "vercel", "done", deploymentUrl);
            await ctx.runMutation(internal.lib.providers.vercel.data.updateVercelProject, {
              projectId: args.projectId,
              deploymentUrl,
            });
          } else {
            await setStep(ctx, args.appId, "vercel", "done", "no deployment alias found");
          }
          return { status: "READY" };
        }

        if (state === "ERROR" || state === "CANCELED") {
          await setStep(ctx, args.appId, "vercel", "error", `Deployment ${state.toLowerCase()}`);
          return { status: state };
        }

        // Still building — update the step message
        await setStep(ctx, args.appId, "vercel", "running", `Building... (${state})`);
      } catch (error) {
        if (isVercelTokenInvalidError(error)) {
          await setStep(
            ctx,
            args.appId,
            "vercel",
            "error",
            getVercelErrorMessage(error),
          );
          return { status: "ERROR" };
        }
        // Transient API errors — keep polling
      }

      // Wait 10 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    // Timed out — still mark vercel step as done so the UI doesn't hang
    await setStep(ctx, args.appId, "vercel", "done", "Deployment timed out");
    return { status: "TIMEOUT" };
  },
});
