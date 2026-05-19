"use node";

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { fetchLatestProductionDeploymentUrlForProject } from "../lib/providers/vercel/platform";
import type { mapInternalApp } from "../lib/apps";

type InternalApp = ReturnType<typeof mapInternalApp>;
type VercelProjectForApp = {
  _id: Id<"vercelProjects">;
  projectId: string;
  projectName: string;
  teamId: string;
};

export const refreshDeploymentMetadata = internalAction({
  args: {
    appId: v.id("apps"),
    userId: v.id("users"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const app: InternalApp | null = await ctx.runQuery(internal.client.apps.internalGetApp, {
      id: args.appId,
    });
    if (!app || app.ownerId !== args.userId) {
      throw new Error("App not found");
    }

    const vercelProject: VercelProjectForApp | null = await ctx.runQuery(
      internal.lib.providers.vercel.data.getVercelProjectByAppId,
      {
        appId: args.appId,
      },
    );
    if (!vercelProject) {
      throw new Error("Vercel project is not set up for this app");
    }

    const vercelToken: { token: string } = await ctx.runQuery(internal.lib.providers.vercel.data.requireVercelTokenForUser, {
      userId: args.userId,
    });

    const deploymentUrl: string | null =
      (await fetchLatestProductionDeploymentUrlForProject(
        vercelToken.token,
        vercelProject.projectId,
        vercelProject.teamId,
        ctx,
        vercelProject.projectName,
      )) ?? null;

    await ctx.runMutation(internal.lib.providers.vercel.data.updateVercelProject, {
      projectId: vercelProject._id,
      deploymentUrl: deploymentUrl ?? undefined,
    });

    return deploymentUrl;
  },
});
