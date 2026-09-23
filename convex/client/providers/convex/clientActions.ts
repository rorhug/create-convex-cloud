"use node";

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { userAction } from "../../../functions";
import { getConvexTokenDetails } from "../../../lib/providers/convex/platform";

export const refreshConvexToken = userAction({
  args: {},
  returns: v.object({
    teams: v.array(
      v.object({
        teamId: v.string(),
        teamSlug: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const existingTokens = await ctx.runQuery(internal.lib.providers.convex.data.listConvexTokensForUser, {
      userId: ctx.userId,
    });
    if (existingTokens.length === 0) {
      throw new Error("Connect Convex first");
    }

    const teams: Array<{ teamId: string; teamSlug: string }> = [];
    let firstError: unknown = null;
    for (const existing of existingTokens) {
      try {
        const details = await getConvexTokenDetails(existing.token, ctx);
        await ctx.runMutation(internal.lib.providers.convex.data.markConvexTokenValid, {
          token: existing.token,
          teamId: details.teamId,
          teamSlug: details.teamSlug,
        });
        teams.push({ teamId: details.teamId, teamSlug: details.teamSlug });
      } catch (error) {
        firstError ??= error;
      }
    }

    if (teams.length === 0) {
      throw firstError instanceof Error ? firstError : new Error("Could not refresh Convex tokens");
    }

    return { teams };
  },
});
