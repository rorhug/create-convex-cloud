import { v } from "convex/values";
import { action, mutation } from "../../../_generated/server";
import { requireCurrentUserId } from "../../../lib/auth";
import { upsertConvexTokenForUser } from "../../../lib/providers/convex/data";
import { getConvexTokenDetails } from "../../../lib/providers/convex/platform";

export const verifyConvexToken = action({
  args: { token: v.string() },
  returns: v.object({
    teamId: v.string(),
    teamName: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);
    const details = await getConvexTokenDetails(args.token);
    return {
      teamId: details.teamId,
      teamName: details.teamName,
    };
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
    await upsertConvexTokenForUser(ctx, userId, args.token, args.teamId);
    return null;
  },
});
