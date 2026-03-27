"use node";

import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";

const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    retryActionsByDefault: false,
  },
});

const TEMPLATE_OWNER = "rorhug";
const TEMPLATE_REPO = "ccc-template";
const CONVEX_API_BASE = "https://api.convex.dev";

// --- Entrypoint (called by scheduler) ---

export const runCreateAppWorkflow = internalAction({
  args: { appId: v.id("apps") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await workflow.start(
        ctx,
        internal.workflows.createAppHelpers.createApp,
        { appId: args.appId },
      );
    } catch (error) {
      console.error("Failed to start create app workflow:", error);
      await ctx.runMutation(internal.apps.internalUpdateAppStatus, {
        id: args.appId,
        status: "error",
      });
    }
    return null;
  },
});

// --- Helper to update step status ---

async function setStep(
  ctx: any,
  appId: any,
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

// --- Step actions ---

export const stepCreateGithubRepo = internalAction({
  args: { appId: v.id("apps") },
  returns: v.object({
    repoFullName: v.string(),
    repoUrl: v.string(),
  }),
  handler: async (ctx, args): Promise<{ repoFullName: string; repoUrl: string }> => {
    await setStep(ctx, args.appId, "github", "running", "Creating GitHub repo from template...");

    const app: any = await ctx.runQuery(internal.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    const user: any = await ctx.runQuery(
      internal.workflows.createAppHelpers.getUser,
      { userId: app.ownerId },
    );
    if (!user?.githubAccessToken) {
      await setStep(ctx, args.appId, "github", "error", "GitHub access token not found");
      throw new Error("GitHub access token not found for user");
    }

    try {
      const octokit = new Octokit({ auth: user.githubAccessToken });

      const response: any = await octokit.request(
        "POST /repos/{template_owner}/{template_repo}/generate",
        {
          template_owner: TEMPLATE_OWNER,
          template_repo: TEMPLATE_REPO,
          name: app.name,
          owner: user.githubUsername ?? undefined,
          description: `Created by create-convex-cloud`,
          private: false,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      const repoFullName: string = response.data.full_name;
      const repoUrl: string = response.data.html_url;

      await ctx.runMutation(
        internal.workflows.createAppHelpers.insertGithubRepo,
        { appId: args.appId, repoFullName, repoUrl },
      );

      await setStep(ctx, args.appId, "github", "done", `Created ${repoFullName}`);
      return { repoFullName, repoUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "github", "error", msg);
      throw error;
    }
  },
});

export const stepCreateConvexProject = internalAction({
  args: { appId: v.id("apps") },
  returns: v.object({
    projectId: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  }),
  handler: async (ctx, args): Promise<{ projectId: string; prodDeployKey: string; previewDeployKey: string }> => {
    await setStep(ctx, args.appId, "convex", "running", "Creating Convex project...");

    const app: any = await ctx.runQuery(internal.apps.internalGetApp, { id: args.appId });
    if (!app) throw new Error("App not found");

    const convexToken: any = await ctx.runQuery(
      internal.workflows.createAppHelpers.getConvexToken,
      { userId: app.ownerId },
    );
    if (!convexToken) {
      await setStep(ctx, args.appId, "convex", "error", "Convex token not found");
      throw new Error("Convex token not found for user");
    }

    try {
      const headers = {
        Authorization: `Bearer ${convexToken.token}`,
        "Content-Type": "application/json",
      };

      // 1. Create project
      await setStep(ctx, args.appId, "convex", "running", "Creating project...");
      const createProjectRes = await fetch(
        `${CONVEX_API_BASE}/v1/teams/${convexToken.teamId}/create_project`,
        { method: "POST", headers, body: JSON.stringify({ projectName: app.name }) },
      );
      if (!createProjectRes.ok) {
        const text = await createProjectRes.text();
        throw new Error(`Failed to create project: ${text}`);
      }
      const project = (await createProjectRes.json()) as any;
      const projectId: string = String(project.id ?? project.projectId ?? project.slug ?? app.name);

      // 2. Create production deployment
      await setStep(ctx, args.appId, "convex", "running", "Creating prod deployment...");
      const createDeploymentRes = await fetch(
        `${CONVEX_API_BASE}/v1/projects/${projectId}/create_deployment`,
        { method: "POST", headers, body: JSON.stringify({ type: "prod" }) },
      );
      if (!createDeploymentRes.ok) {
        const text = await createDeploymentRes.text();
        throw new Error(`Failed to create deployment: ${text}`);
      }
      const deployment = (await createDeploymentRes.json()) as any;
      const prodDeploymentName: string = deployment.deploymentName ?? deployment.name ?? "";

      // 3. Create production deploy key
      await setStep(ctx, args.appId, "convex", "running", "Creating deploy keys...");
      const createDeployKeyRes = await fetch(
        `${CONVEX_API_BASE}/v1/deployments/${prodDeploymentName}/create_deploy_key`,
        { method: "POST", headers, body: JSON.stringify({ name: `${app.name}-prod` }) },
      );
      if (!createDeployKeyRes.ok) {
        const text = await createDeployKeyRes.text();
        throw new Error(`Failed to create deploy key: ${text}`);
      }
      const deployKeyData = (await createDeployKeyRes.json()) as any;
      const prodDeployKey: string = deployKeyData.key ?? deployKeyData.deployKey ?? "";

      // 4. Create preview deploy key
      const createPreviewKeyRes = await fetch(
        `${CONVEX_API_BASE}/v1/projects/${projectId}/create_preview_deploy_key`,
        { method: "POST", headers, body: JSON.stringify({ name: `${app.name}-preview` }) },
      );
      if (!createPreviewKeyRes.ok) {
        const text = await createPreviewKeyRes.text();
        throw new Error(`Failed to create preview deploy key: ${text}`);
      }
      const previewKeyData = (await createPreviewKeyRes.json()) as any;
      const previewDeployKey: string = previewKeyData.key ?? previewKeyData.deployKey ?? "";

      // Store in DB
      await ctx.runMutation(
        internal.workflows.createAppHelpers.insertConvexProject,
        {
          appId: args.appId,
          projectId,
          teamId: convexToken.teamId,
          prodDeploymentName,
          prodDeployKey,
          previewDeployKey,
        },
      );

      await setStep(ctx, args.appId, "convex", "done", `Created project ${projectId}`);
      return { projectId, prodDeployKey, previewDeployKey };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "convex", "error", msg);
      throw error;
    }
  },
});

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
  }),
  handler: async (ctx, args): Promise<{ projectId: string; projectName: string }> => {
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

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create Vercel project: ${text}`);
      }

      const project = (await response.json()) as { id: string; name: string };

      await ctx.runMutation(
        internal.workflows.createAppHelpers.insertVercelProject,
        {
          appId: args.appId,
          projectId: project.id,
          projectName: project.name,
          teamId: teamId ?? undefined,
        },
      );

      await setStep(ctx, args.appId, "vercel", "done", `Created ${project.name}`);
      return { projectId: project.id, projectName: project.name };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "vercel", "error", msg);
      throw error;
    }
  },
});
