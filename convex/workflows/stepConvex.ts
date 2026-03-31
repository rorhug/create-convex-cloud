"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { setStep } from "./stepUtils";

const CONVEX_API_BASE = "https://api.convex.dev";

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
