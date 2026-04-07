"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { setStep } from "./stepUtils";
import { createManagementClient } from "@convex-dev/platform";

function formatPlatformError(response: Response, error: unknown) {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

function unwrapPlatformResult<T>(
  result: { data: T; error?: never; response: Response } | { data?: never; error: unknown; response: Response },
  message: string,
): T {
  if ("error" in result && result.error !== undefined) {
    throw new Error(`${message}: ${formatPlatformError(result.response, result.error)}`);
  }
  if (result.data === undefined) {
    throw new Error(`${message}: Missing response data`);
  }
  return result.data;
}

export const stepCreateConvexProject = internalAction({
  args: { appId: v.id("apps") },
  returns: v.object({
    projectId: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    projectId: string;
    prodDeployKey: string;
    previewDeployKey: string;
  }> => {
    await setStep(ctx, args.appId, "convex", "running", "Creating Convex project...");

    const app = await ctx.runQuery(internal.client.apps.internalGetApp, {
      id: args.appId,
    });
    if (!app) throw new Error("App not found");

    const convexToken = await ctx.runQuery(internal.lib.providers.convex.data.getConvexTokenForUser, {
      userId: app.ownerId,
    });
    if (!convexToken) {
      await setStep(ctx, args.appId, "convex", "error", "Convex token not found");
      throw new Error("Convex token not found for user");
    }

    try {
      const teamId = Number(convexToken.teamId);
      if (!Number.isFinite(teamId)) {
        throw new Error(`Invalid Convex team ID: ${convexToken.teamId}`);
      }

      const convexPlatform = createManagementClient(convexToken.token);

      // 1. Create project
      await setStep(ctx, args.appId, "convex", "running", "Creating project...");
      const createProjectResult = await convexPlatform.POST("/teams/{team_id}/create_project", {
        params: { path: { team_id: teamId } },
        body: { projectName: app.name },
      });
      const project = unwrapPlatformResult(createProjectResult, "Failed to create project")!;
      const projectId = project.projectId;
      const projectIdString = String(projectId);

      // 2. Create production deployment
      await setStep(ctx, args.appId, "convex", "running", "Creating prod deployment...");
      const createDeploymentResult = await convexPlatform.POST("/projects/{project_id}/create_deployment", {
        params: { path: { project_id: projectId } },
        body: { type: "prod" },
      });
      const deployment = unwrapPlatformResult(createDeploymentResult, "Failed to create deployment")!;
      const prodDeploymentName = deployment.name;

      // 3. Create production deploy key
      await setStep(ctx, args.appId, "convex", "running", "Creating deploy keys...");
      const createDeployKeyResult = await convexPlatform.POST("/deployments/{deployment_name}/create_deploy_key", {
        params: { path: { deployment_name: prodDeploymentName } },
        body: { name: `ccc-vercel-prod` },
      });
      const deployKey = unwrapPlatformResult(createDeployKeyResult, "Failed to create deploy key")!;
      const prodDeployKey = deployKey.deployKey;

      // 4. Create preview deploy key
      const createPreviewKeyResult = await convexPlatform.POST("/projects/{project_id}/create_preview_deploy_key", {
        params: { path: { project_id: projectId } },
        body: { name: `ccc-vercel-preview` },
      });
      const previewKey = unwrapPlatformResult(createPreviewKeyResult, "Failed to create preview deploy key")!;
      const previewDeployKey = previewKey.previewDeployKey;

      const projectDetailsResult = await convexPlatform.GET("/projects/{project_id}", {
        params: { path: { project_id: projectId } },
      });
      const projectDetails = unwrapPlatformResult(projectDetailsResult, "Failed to get project details");
      if (!projectDetails) {
        throw new Error("Failed to get project details: missing project");
      }
      if (!projectDetails.teamSlug || !projectDetails.slug) {
        throw new Error("Convex project details missing teamSlug or slug");
      }

      // Store in DB
      await ctx.runMutation(internal.lib.providers.convex.data.insertConvexProject, {
        appId: args.appId,
        projectId: projectIdString,
        teamId: convexToken.teamId,
        teamSlug: projectDetails.teamSlug,
        projectSlug: projectDetails.slug,
        prodDeploymentName,
        prodDeployKey,
        previewDeployKey,
      });

      await setStep(ctx, args.appId, "convex", "done", `Created project ${projectIdString}`);
      return { projectId: projectIdString, prodDeployKey, previewDeployKey };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "convex", "error", msg);
      throw error;
    }
  },
});
