import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { requireCurrentUserId } from "./lib/auth";

export const verifyConvexToken = action({
  args: { token: v.string() },
  returns: v.object({
    teamId: v.string(),
    teamName: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const token = args.token.trim();
    if (token.length < 10) {
      throw new Error("Token looks too short");
    }

    const response = await fetch("https://api.convex.dev/v1/token_details", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Convex token is invalid or expired");
    }

    const data = (await response.json()) as {
      type?: string;
      teamId?: number;
      name?: string;
    };

    // Extract team slug from token format "team:slug|..."
    const match = token.match(/^team:([^|]+)\|/);
    const teamSlug = match?.[1] ?? "";
    const teamId = teamSlug || String(data.teamId ?? "");
    const teamName = data.name ?? teamId;

    if (!teamId) {
      throw new Error("Could not determine team ID from token");
    }

    return { teamId, teamName };
  },
});

export const saveConvexToken = mutation({
  args: {
    token: v.string(),
    teamId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);

    // Upsert: delete old token if exists
    const existing = await ctx.db
      .query("convexTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("convexTokens", {
      userId,
      token: args.token.trim(),
      teamId: args.teamId,
    });

    return null;
  },
});
