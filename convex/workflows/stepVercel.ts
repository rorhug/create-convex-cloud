"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { setStep } from "./stepUtils";

export const stepCreateVercelProject = internalAction({
  args: {
    appId: v.id("apps"),
    repoFullName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  },
  returns: v.object({
    projectId: v.string(),
    projectName: v.string(),
    deploymentUrl: v.string(),
    deploymentId: v.optional(v.string()),
    vercelToken: v.string(),
    teamId: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ projectId: string; projectName: string; deploymentUrl: string; deploymentId?: string; vercelToken: string; teamId?: string }> => {
    await setStep(ctx, args.appId, "vercel", "running", "Creating Vercel project...");

    const app: any = await ctx.runQuery(internal.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    const vercelToken: any = await ctx.runQuery(
      internal.workflows.createAppHelpers.getVercelToken,
      { userId: app.ownerId },
    );
    if (!vercelToken) {
      await setStep(ctx, args.appId, "vercel", "error", "Vercel token not found");
      throw new Error("Vercel token not found for user");
    }

    try {
      const teamId: string | undefined =
        vercelToken.teams.length > 0 ? vercelToken.teams[0].id : undefined;

      const url = teamId
        ? `https://api.vercel.com/v11/projects?teamId=${teamId}`
        : "https://api.vercel.com/v11/projects";

      // Build command: run setup script to sync Convex env, then deploy + build.
      // Must match the buildCommand in vercel.json (injected by SUPPLEMENTARY_FILES).
      // --cmd-url-env-var-name injects NEXT_PUBLIC_CONVEX_URL before npm run build
      // so Next.js knows the Convex URL at build time.
      // set-convex-env.sh runs after the build to push JWT keys + SITE_URL to
      // the Convex deployment (it only needs CONVEX_DEPLOY_KEY, not build-time vars).
      const buildCommand = `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL && sh ./set-convex-env.sh`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: app.name,
          framework: "nextjs",
          buildCommand,
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
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create Vercel project: ${text}`);
      }

      const project = (await response.json()) as { id: string; name: string };
      const deploymentUrl = `https://${project.name}.vercel.app`;

      // Trigger initial deployment
      await setStep(ctx, args.appId, "vercel", "running", "Triggering first deployment...");
      const [repoOrg, repoName] = args.repoFullName.split("/");
      const deployUrl = teamId
        ? `https://api.vercel.com/v13/deployments?teamId=${teamId}`
        : "https://api.vercel.com/v13/deployments";

      const deployRes = await fetch(deployUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: project.name,
          target: "production",
          gitSource: {
            type: "github",
            org: repoOrg,
            repo: repoName,
            ref: "main",
          },
        }),
      });

      let deploymentId: string | undefined;
      if (!deployRes.ok) {
        const text = await deployRes.text();
        console.error("Failed to trigger deployment (non-fatal):", text);
      } else {
        const deployData = (await deployRes.json()) as { id: string };
        deploymentId = deployData.id;
      }

      await ctx.runMutation(
        internal.workflows.createAppHelpers.insertVercelProject,
        {
          appId: args.appId,
          projectId: project.id,
          projectName: project.name,
          teamId: teamId ?? undefined,
          deploymentUrl,
        },
      );

      await setStep(ctx, args.appId, "vercel", "running", "Deploying...");
      return { projectId: project.id, projectName: project.name, deploymentUrl, deploymentId, vercelToken: vercelToken.token, teamId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
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
    teamId: v.optional(v.string()),
    deploymentUrl: v.string(),
  },
  returns: v.object({ status: v.string() }),
  handler: async (ctx, args): Promise<{ status: string }> => {
    await setStep(ctx, args.appId, "vercel", "running", "Waiting for deployment to finish...");

    const maxAttempts = 30; // ~5 minutes (10s intervals)
    for (let i = 0; i < maxAttempts; i++) {
      const url = args.teamId
        ? `https://api.vercel.com/v13/deployments/${args.deploymentId}?teamId=${args.teamId}`
        : `https://api.vercel.com/v13/deployments/${args.deploymentId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${args.vercelToken}` },
      });

      if (res.ok) {
        const data = (await res.json()) as { readyState: string };
        const state = data.readyState;

        if (state === "READY") {
          await setStep(ctx, args.appId, "vercel", "done", args.deploymentUrl);
          return { status: "READY" };
        }

        if (state === "ERROR" || state === "CANCELED") {
          await setStep(ctx, args.appId, "vercel", "error", `Deployment ${state.toLowerCase()}`);
          return { status: state };
        }

        // Still building — update the step message
        await setStep(ctx, args.appId, "vercel", "running", `Building... (${state})`);
      }

      // Wait 10 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    // Timed out — still mark vercel step as done so the UI doesn't hang
    await setStep(ctx, args.appId, "vercel", "done", args.deploymentUrl);
    return { status: "TIMEOUT" };
  },
});
