"use node";

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { action } from "../../../_generated/server";
import { requireCurrentUserId } from "../../../lib/auth";
import { teamValidator } from "../../../lib/providers/vercel/data";
import { fetchVercelTeamsForToken } from "../../../lib/providers/vercel/platform";

export const verifyVercelToken = action({
  args: { token: v.string() },
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const teams = await fetchVercelTeamsForToken(args.token, ctx);
    return { teams };
  },
});

export const saveVercelToken = action({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const teams = await fetchVercelTeamsForToken(args.token, ctx);
    await ctx.runMutation(internal.lib.providers.vercel.data.upsertVercelToken, {
      userId,
      token: args.token,
      teams,
    });
    return null;
  },
});

export const refreshVercelTeams = action({
  args: {},
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx) => {
    const userId = await requireCurrentUserId(ctx);
    const existing = await ctx.runQuery(internal.lib.providers.vercel.data.requireVercelTokenForUser, {
      userId,
      allowInvalid: true,
    });

    const teams = await fetchVercelTeamsForToken(existing.token, ctx);
    await ctx.runMutation(internal.lib.providers.vercel.data.upsertVercelToken, {
      userId,
      token: existing.token,
      teams,
    });
    return { teams };
  },
});
