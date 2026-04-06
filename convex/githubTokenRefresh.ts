import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getGithubTokenDocForUser } from "./lib/githubAuthAccount";

export const getGithubTokenRowForRefresh = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      githubUserId: v.string(),
      token: v.string(),
      accessTokenExpiresAt: v.optional(v.number()),
      refreshToken: v.optional(v.string()),
      username: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const doc = await getGithubTokenDocForUser(ctx, args.userId);
    if (!doc) return null;
    return {
      githubUserId: doc.githubUserId,
      token: doc.token,
      accessTokenExpiresAt: doc.accessTokenExpiresAt,
      refreshToken: doc.refreshToken,
      username: doc.username,
    };
  },
});

export const applyGithubOAuthRefresh = internalMutation({
  args: {
    githubUserId: v.string(),
    accessToken: v.string(),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("githubTokens")
      .withIndex("by_github_user_id", (q) => q.eq("githubUserId", args.githubUserId))
      .first();
    if (!existing) {
      throw new Error("githubTokens row not found for GitHub user");
    }
    const patch: {
      token: string;
      accessTokenExpiresAt?: number;
      refreshToken?: string;
    } = { token: args.accessToken };
    if (args.accessTokenExpiresAt !== undefined) {
      patch.accessTokenExpiresAt = args.accessTokenExpiresAt;
    }
    if (args.refreshToken !== undefined) {
      patch.refreshToken = args.refreshToken;
    }
    await ctx.db.patch(existing._id, patch);
    return null;
  },
});
