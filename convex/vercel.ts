import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser, requireCurrentUserId } from "./lib/auth";

const teamValidator = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
});

type VercelTeam = { id: string; name: string; slug: string };

/** Shared with verify + save: call Vercel and normalize teams. */
async function fetchVercelTeamsForToken(token: string): Promise<VercelTeam[]> {
  const trimmed = token.trim();
  if (trimmed.length < 10) {
    throw new Error("Vercel token looks too short");
  }

  const teamsResponse = await fetch("https://api.vercel.com/v2/teams", {
    headers: {
      Authorization: `Bearer ${trimmed}`,
    },
  });

  if (!teamsResponse.ok) {
    throw new Error("Vercel token is invalid or expired");
  }

  const data = (await teamsResponse.json()) as {
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

  if (teams.length === 0) {
    throw new Error(
      "No Vercel teams found for this token. Check token access or your Vercel account.",
    );
  }

  return teams;
}

export const verifyVercelToken = action({
  args: { token: v.string() },
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const teams = await fetchVercelTeamsForToken(args.token);
    return { teams };
  },
});

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

export const saveVercelToken = action({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const teams = await fetchVercelTeamsForToken(args.token);
    await ctx.runMutation(internal.vercel.internalUpsertVercelToken, {
      userId,
      token: args.token,
      teams,
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
