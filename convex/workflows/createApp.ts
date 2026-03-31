"use node";

import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Octokit } from "octokit";
import { TEMPLATES } from "./templateFiles";

const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    retryActionsByDefault: false,
  },
});

const CONVEX_API_BASE = "https://api.convex.dev";
const DEFAULT_TEMPLATE = "nextjs-convex-auth";

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
    await setStep(ctx, args.appId, "github", "running", "Creating GitHub repo...");

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

    const octokit = new Octokit({ auth: user.githubAccessToken });
    const owner: string = user.githubUsername ?? "";
    let repoCreated = false;

    try {
      // 1. Create the repo with auto_init:true so GitHub initialises the git
      //    object database. Without this, the blobs/trees/commits APIs return
      //    "Git Repository is empty" because there is no git db to write into.
      const createRepoRes: any = await octokit.request("POST /user/repos", {
        name: app.name,
        description: "Created by create-convex-cloud",
        private: false,
        auto_init: true,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      repoCreated = true;

      const repoFullName: string = createRepoRes.data.full_name;
      const repoUrl: string = createRepoRes.data.html_url;
      const defaultBranch: string = createRepoRes.data.default_branch ?? "main";

      // 2. Create git blobs for every template file (in parallel)
      await setStep(ctx, args.appId, "github", "running", "Uploading template files...");
      const templateFiles = TEMPLATES[DEFAULT_TEMPLATE] ?? [];

      const blobShas: string[] = await Promise.all(
        templateFiles.map(async (file) => {
          const blobRes: any = await octokit.request(
            "POST /repos/{owner}/{repo}/git/blobs",
            {
              owner,
              repo: app.name,
              content: file.content,
              encoding: "utf-8",
              headers: { "X-GitHub-Api-Version": "2022-11-28" },
            },
          );
          return blobRes.data.sha as string;
        }),
      );

      // 3. Create a git tree referencing all blobs
      await setStep(ctx, args.appId, "github", "running", "Building file tree...");
      const tree = templateFiles.map((file, i) => ({
        path: file.path,
        mode: (file.executable ? "100755" : "100644") as "100755" | "100644",
        type: "blob" as const,
        sha: blobShas[i],
      }));

      const treeRes: any = await octokit.request(
        "POST /repos/{owner}/{repo}/git/trees",
        {
          owner,
          repo: app.name,
          tree,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        },
      );
      const treeSha: string = treeRes.data.sha;

      // 4. Create an orphan commit (no parents) with all template files.
      //    This gives a single clean "Initial commit" in the repo history
      //    instead of two commits (the auto_init one + ours).
      const commitRes: any = await octokit.request(
        "POST /repos/{owner}/{repo}/git/commits",
        {
          owner,
          repo: app.name,
          message: "Initial commit",
          tree: treeSha,
          parents: [],
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        },
      );
      const commitSha: string = commitRes.data.sha;

      // 5. Force-update the default branch ref to point at our orphan commit,
      //    replacing the auto_init commit so history stays clean (1 commit).
      await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo: app.name,
        ref: `heads/${defaultBranch}`,
        sha: commitSha,
        force: true,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });

      await ctx.runMutation(
        internal.workflows.createAppHelpers.insertGithubRepo,
        { appId: args.appId, repoFullName, repoUrl },
      );

      await setStep(ctx, args.appId, "github", "done", `Created ${repoFullName}`);
      return { repoFullName, repoUrl };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "github", "error", msg);

      // Clean up the partially-created repo so the user doesn't end up with
      // an empty orphaned repository in their GitHub account.
      if (repoCreated) {
        try {
          await octokit.request("DELETE /repos/{owner}/{repo}", {
            owner,
            repo: app.name,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
        } catch (cleanupErr) {
          console.error("Failed to clean up repo after error:", cleanupErr);
        }
      }

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
      // Must match the buildCommand in templates/nextjs-convex-auth/vercel.json.
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

    // Timed out
    await setStep(ctx, args.appId, "vercel", "done", args.deploymentUrl);
    return { status: "TIMEOUT" };
  },
});
