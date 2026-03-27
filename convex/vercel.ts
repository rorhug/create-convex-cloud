import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireCurrentUser, requireCurrentUserId } from "./lib/auth";

const teamValidator = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
});

export const verifyVercelToken = action({
  args: { token: v.string() },
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const token = args.token.trim();
    if (token.length < 10) {
      throw new Error("Vercel token looks too short");
    }

    const response = await fetch("https://api.vercel.com/v2/teams", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Vercel token is invalid or expired");
    }

    const data = (await response.json()) as {
      teams?: Array<{
        id: string;
        name: string | null;
        slug: string;
      }>;
    };

    const teams = (data.teams ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? t.slug,
      slug: t.slug,
    }));

    return { teams };
  },
});

export const saveVercelToken = mutation({
  args: {
    token: v.string(),
    teams: v.array(teamValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);

    // Upsert: delete old token if exists
    const existing = await ctx.db
      .query("vercelTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("vercelTokens", {
      userId,
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
    const tokenPreview =
      token.length <= 8
        ? "********"
        : `${token.slice(0, 4)}...${token.slice(-4)}`;

    return {
      teams: tokenDoc.teams,
      tokenPreview,
    };
  },
});
