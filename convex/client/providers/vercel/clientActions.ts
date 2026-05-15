"use node";

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { userAction } from "../../../functions";
import { teamValidator } from "../../../lib/providers/vercel/data";
import { fetchVercelTeamsForToken } from "../../../lib/providers/vercel/platform";

export const verifyVercelToken = userAction({
  args: { token: v.string() },
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx, args) => {
    const teams = await fetchVercelTeamsForToken(args.token, ctx);
    return { teams };
  },
});

export const saveVercelToken = userAction({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teams = await fetchVercelTeamsForToken(args.token, ctx);
    await ctx.runMutation(internal.lib.providers.vercel.data.upsertVercelToken, {
      userId: ctx.userId,
      token: args.token,
      teams,
    });
    return null;
  },
});

export const refreshVercelTeams = userAction({
  args: {},
  returns: v.object({
    teams: v.array(teamValidator),
  }),
  handler: async (ctx) => {
    const existing = await ctx.runQuery(internal.lib.providers.vercel.data.requireVercelTokenForUser, {
      userId: ctx.userId,
      allowInvalid: true,
    });

    const teams = await fetchVercelTeamsForToken(existing.token, ctx);
    await ctx.runMutation(internal.lib.providers.vercel.data.upsertVercelToken, {
      userId: ctx.userId,
      token: existing.token,
      teams,
    });
    return { teams };
  },
});
