import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser, requireCurrentUserId } from "./lib/auth";
import { createVercelClient } from "./lib/vercelClient";

export const teamValidator = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
});

/** Shared with verify + save: call Vercel and normalize teams. */

export const internalUpsertVercelToken = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    teams: v.array(teamValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vercelTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("vercelTokens", {
      userId: args.userId,
      token: args.token.trim(),
      teams: args.teams,
    });
    return null;
  },
});

export const getVercelToken = query({
  args: {},
  returns: v.union(
    v.object({
      teams: v.array(teamValidator),
      tokenPreview: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const tokenDoc = await ctx.db
      .query("vercelTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!tokenDoc) return null;

    const token = tokenDoc.token;
    const tokenPreview = token.length <= 8 ? "********" : `${token.slice(0, 4)}...${token.slice(-4)}`;

    return {
      teams: tokenDoc.teams,
      tokenPreview,
    };
  },
});
