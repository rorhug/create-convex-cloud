import { v } from "convex/values";
import type { Id } from "../../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../../_generated/server";
import type { MutationCtx } from "../../../_generated/server";

export async function upsertConvexTokenForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  token: string,
  teamId: string,
  providerAccountId?: string,
) {
  const existingToken = await ctx.db
    .query("convexTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  const tokenDoc = {
    providerAccountId,
    teamId,
    token: token.trim(),
    tokenStatus: "valid" as const,
    userId,
  };

  if (existingToken) {
    await ctx.db.patch(existingToken._id, tokenDoc);
    return;
  }

  await ctx.db.insert("convexTokens", tokenDoc);
}

export const getConvexTokenForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      token: v.string(),
      teamId: v.string(),
      tokenStatus: v.union(v.literal("valid"), v.literal("invalid")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("convexTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!tokenDoc) return null;
    return {
      token: tokenDoc.token,
      teamId: tokenDoc.teamId,
      tokenStatus: tokenDoc.tokenStatus,
    };
  },
});

export const markConvexTokenInvalid = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("convexTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token.trim()))
      .first();
    if (!tokenDoc) {
      return null;
    }
    await ctx.db.patch(tokenDoc._id, {
      tokenStatus: "invalid",
    });
    return null;
  },
});

export const getConvexProjectByAppId = internalQuery({
  args: { appId: v.id("apps") },
  returns: v.union(
    v.object({
      projectId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("convexProjects")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .first();
    if (!project) return null;
    return { projectId: project.projectId };
  },
});

export const insertConvexProject = internalMutation({
  args: {
    appId: v.id("apps"),
    projectId: v.string(),
    teamId: v.string(),
    teamSlug: v.string(),
    projectSlug: v.string(),
    prodDeploymentName: v.string(),
    prodDeployKey: v.string(),
    previewDeployKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("convexProjects", {
      appId: args.appId,
      projectId: args.projectId,
      teamId: args.teamId,
      teamSlug: args.teamSlug,
      projectSlug: args.projectSlug,
      prodDeploymentName: args.prodDeploymentName,
      prodDeployKey: args.prodDeployKey,
      previewDeployKey: args.previewDeployKey,
    });
    return null;
  },
});
