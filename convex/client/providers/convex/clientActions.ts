"use node";

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { userAction } from "../../../functions";
import { getConvexTokenDetails } from "../../../lib/providers/convex/platform";

export const refreshConvexToken = userAction({
  args: {},
  returns: v.object({
    teamId: v.string(),
    teamSlug: v.string(),
  }),
  handler: async (ctx) => {
    const existing = await ctx.runQuery(
      internal.lib.providers.convex.data.getConvexTokenForUser,
      { userId: ctx.userId },
    );
    if (!existing) {
      throw new Error("Connect Convex first");
    }

    const details = await getConvexTokenDetails(existing.token, ctx);
    await ctx.runMutation(internal.lib.providers.convex.data.markConvexTokenValid, {
      token: existing.token,
      teamId: details.teamId,
      teamSlug: details.teamSlug,
    });
    return { teamId: details.teamId, teamSlug: details.teamSlug };
  },
});
