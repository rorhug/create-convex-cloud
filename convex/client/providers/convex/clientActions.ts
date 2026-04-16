"use node";

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { action } from "../../../_generated/server";
import { requireCurrentUserId } from "../../../lib/auth";
import { getConvexTokenDetails } from "../../../lib/providers/convex/platform";

export const refreshConvexToken = action({
  args: {},
  returns: v.object({
    teamId: v.string(),
  }),
  handler: async (ctx) => {
    const userId = await requireCurrentUserId(ctx);
    const existing = await ctx.runQuery(
      internal.lib.providers.convex.data.getConvexTokenForUser,
      { userId },
    );
    if (!existing) {
      throw new Error("Connect Convex first");
    }

    const details = await getConvexTokenDetails(existing.token, ctx);
    await ctx.runMutation(internal.lib.providers.convex.data.markConvexTokenValid, {
      token: existing.token,
      teamId: details.teamId,
    });
    return { teamId: details.teamId };
  },
});
