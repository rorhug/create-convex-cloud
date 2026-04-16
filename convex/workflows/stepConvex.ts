"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { setStep } from "./stepUtils";
import { createManagementClient } from "@convex-dev/platform";
import {
  unwrapConvexPlatformResult,
} from "../lib/providers/convex/platform";

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
    await setStep(ctx, args.appId, "convex", "creating", "Creating Convex project...");

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
      await setStep(ctx, args.appId, "convex", "creating", "Creating project...");
      const createProjectResult = await convexPlatform.POST("/teams/{team_id}/create_project", {
        params: { path: { team_id: teamId } },
        body: { projectName: app.name },
      });
      const project = await unwrapConvexPlatformResult(
        ctx,
        convexToken.token,
        createProjectResult,
        "Failed to create project",
      );
      if (!project) {
        throw new Error("Failed to create project: missing project");
      }
      const projectId = project.projectId;
      const projectIdString = String(projectId);

      // 2. Create production deployment
      await setStep(ctx, args.appId, "convex", "creating", "Creating prod deployment...");
      const createDeploymentResult = await convexPlatform.POST("/projects/{project_id}/create_deployment", {
        params: { path: { project_id: projectId } },
        body: { type: "prod" },
      });
      const deployment = await unwrapConvexPlatformResult(
        ctx,
        convexToken.token,
        createDeploymentResult,
        "Failed to create deployment",
      );
      if (!deployment) {
        throw new Error("Failed to create deployment: missing deployment");
      }
      const prodDeploymentName = deployment.name;

      // 3. Create production deploy key
      await setStep(ctx, args.appId, "convex", "creating", "Creating deploy keys...");
      const createDeployKeyResult = await convexPlatform.POST("/deployments/{deployment_name}/create_deploy_key", {
        params: { path: { deployment_name: prodDeploymentName } },
        body: { name: `ccc-vercel-prod` },
      });
      const deployKey = await unwrapConvexPlatformResult(
        ctx,
        convexToken.token,
        createDeployKeyResult,
        "Failed to create deploy key",
      );
      if (!deployKey) {
        throw new Error("Failed to create deploy key: missing deploy key");
      }
      const prodDeployKey = deployKey.deployKey;

      // 4. Create preview deploy key
      const createPreviewKeyResult = await convexPlatform.POST("/projects/{project_id}/create_preview_deploy_key", {
        params: { path: { project_id: projectId } },
        body: { name: `ccc-vercel-preview` },
      });
      const previewKey = await unwrapConvexPlatformResult(
        ctx,
        convexToken.token,
        createPreviewKeyResult,
        "Failed to create preview deploy key",
      );
      if (!previewKey) {
        throw new Error("Failed to create preview deploy key: missing preview deploy key");
      }
      const previewDeployKey = previewKey.previewDeployKey;

      const projectDetailsResult = await convexPlatform.GET("/projects/{project_id}", {
        params: { path: { project_id: projectId } },
      });
      const projectDetails = await unwrapConvexPlatformResult(
        ctx,
        convexToken.token,
        projectDetailsResult,
        "Failed to get project details",
      );
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

      await setStep(ctx, args.appId, "convex", "ready", `Created project ${projectIdString}`);
      return { projectId: projectIdString, prodDeployKey, previewDeployKey };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await setStep(ctx, args.appId, "convex", "error", msg);
      throw error;
    }
  },
});
